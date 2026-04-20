import subprocess
import time
import pyodbc
import sys

SERVER = "localhost"
SQL_LOGIN = "Anthony"
SQL_PASSWORD = "StrongPassword123!"
DATABASE = "RMAAAuthDB"


def print_header(title):
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def get_driver():
    drivers = [d for d in pyodbc.drivers() if "SQL Server" in d]
    if not drivers:
        raise RuntimeError("No SQL Server ODBC driver found.")
    return drivers[-1]


def connect_windows(database="master"):
    driver = get_driver()
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={SERVER};"
        f"DATABASE={database};"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, autocommit=True, timeout=10)


def connect_sql(login, password, database):
    driver = get_driver()
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={SERVER};"
        f"DATABASE={database};"
        f"UID={login};"
        f"PWD={password};"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str, autocommit=True, timeout=5)


def restart_sql_service():
    print_header("STEP 1: RESTART SQL SERVER SERVICE")
    services = ["MSSQLSERVER", "MSSQL$SQLEXPRESS"]
    for service in services:
        try:
            print(f"Trying to restart: {service}")
            r1 = subprocess.run(["net", "stop", service], capture_output=True, text=True)
            print(r1.stdout.strip() or r1.stderr.strip())
            time.sleep(3)
            r2 = subprocess.run(["net", "start", service], capture_output=True, text=True)
            print(r2.stdout.strip() or r2.stderr.strip())
            if "started successfully" in r2.stdout.lower():
                print(f"[OK] {service} restarted.")
                return True
        except Exception as e:
            print(f"[INFO] Could not restart {service}: {e}")
    print("[FAIL] Could not restart SQL Server automatically.")
    return False


def check_mixed_mode():
    """
    Check mixed mode using sys.configurations instead of SERVERPROPERTY
    to avoid the ODBC type -16 bug with ODBC Driver 18.
    """
    print_header("STEP 2: CHECK MIXED MODE AUTH")
    try:
        conn = connect_windows("master")
        cursor = conn.cursor()

        # Use registry-based check via xp_instance_regread
        # This avoids the SERVERPROPERTY type -16 ODBC bug entirely
        cursor.execute("""
            DECLARE @AuthMode INT;
            EXEC master.dbo.xp_instance_regread
                N'HKEY_LOCAL_MACHINE',
                N'Software\\Microsoft\\MSSQLServer\\MSSQLServer',
                N'LoginMode',
                @AuthMode OUTPUT;
            SELECT @AuthMode AS LoginMode;
        """)
        row = cursor.fetchone()
        mode = row[0] if row else None

        print(f"[INFO] LoginMode registry value: {mode}")
        print("[INFO] 1 = Windows Only, 2 = Mixed Mode (SQL + Windows)")

        if mode == 2:
            print("[OK] Mixed Mode is ENABLED. SQL logins are allowed.")
            conn.close()
            return True
        elif mode == 1:
            print("[FAIL] Server is in Windows-only mode.")
            print("[INFO] In SSMS: right-click server > Properties > Security")
            print("[INFO] Select 'SQL Server and Windows Authentication mode'")
            print("[INFO] Then restart SQL Server and run this script again.")
            conn.close()
            return False
        else:
            print(f"[WARN] Unexpected LoginMode value: {mode}. Proceeding anyway.")
            conn.close()
            return True

    except Exception as e:
        print(f"[WARN] Could not read registry mode: {e}")
        print("[INFO] Assuming Mixed Mode is set — will attempt login test anyway.")
        return True


def fix_login():
    print_header("STEP 3: RESET SQL LOGIN")
    try:
        conn = connect_windows("master")
        cursor = conn.cursor()

        cursor.execute(f"""
            IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = '{SQL_LOGIN}')
            BEGIN
                ALTER LOGIN [{SQL_LOGIN}] WITH PASSWORD = '{SQL_PASSWORD}';
                ALTER LOGIN [{SQL_LOGIN}] ENABLE;
                PRINT 'Login reset and enabled.';
            END
            ELSE
            BEGIN
                CREATE LOGIN [{SQL_LOGIN}]
                WITH PASSWORD = '{SQL_PASSWORD}',
                     CHECK_POLICY = OFF,
                     CHECK_EXPIRATION = OFF;
                ALTER LOGIN [{SQL_LOGIN}] ENABLE;
                PRINT 'Login created.';
            END
        """)
        print(f"[OK] Login '{SQL_LOGIN}' password reset and enabled.")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[FAIL] Could not reset login: {e}")
        return False


def ensure_db_user():
    print_header("STEP 4: ENSURE DATABASE USER EXISTS")
    try:
        conn = connect_windows(DATABASE)
        cursor = conn.cursor()

        cursor.execute(f"""
            IF NOT EXISTS (
                SELECT 1 FROM sys.database_principals WHERE name = '{SQL_LOGIN}'
            )
            BEGIN
                CREATE USER [{SQL_LOGIN}] FOR LOGIN [{SQL_LOGIN}];
            END

            IF NOT EXISTS (
                SELECT 1
                FROM sys.database_role_members drm
                JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
                JOIN sys.database_principals m ON drm.member_principal_id = m.principal_id
                WHERE r.name = 'db_owner' AND m.name = '{SQL_LOGIN}'
            )
            BEGIN
                ALTER ROLE db_owner ADD MEMBER [{SQL_LOGIN}];
            END
        """)
        print(f"[OK] Database user '{SQL_LOGIN}' exists and is in db_owner.")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[FAIL] Could not ensure DB user: {e}")
        return False


def test_sql_login():
    print_header("STEP 5: TEST SQL LOGIN DIRECTLY")
    try:
        conn = connect_sql(SQL_LOGIN, SQL_PASSWORD, DATABASE)
        cursor = conn.cursor()
        cursor.execute("SELECT @@SERVERNAME, DB_NAME(), SUSER_SNAME()")
        row = cursor.fetchone()
        print(f"[OK] SQL login succeeded!")
        print(f"[INFO] Server   : {row[0]}")
        print(f"[INFO] Database : {row[1]}")
        print(f"[INFO] Login    : {row[2]}")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[FAIL] SQL login still failing: {e}")
        return False


def main():
    print("Run this script as Administrator for best results.\n")

    restart_sql_service()

    print("\nWaiting 5 seconds for SQL Server to fully come back online...")
    time.sleep(5)

    mixed_ok = check_mixed_mode()

    if not mixed_ok:
        print("\n[STOP] Enable Mixed Mode in SSMS first, restart SQL Server, then re-run.")
        sys.exit(1)

    fix_login()
    ensure_db_user()

    success = test_sql_login()

    print_header("FINAL RESULT")
    if success:
        print("[OK] SQL login is working!")
        print("\nYour .env should be:")
        print(f"DB_USER={SQL_LOGIN}")
        print(f"DB_PASSWORD={SQL_PASSWORD}")
        print("DB_SERVER=localhost")
        print("DB_PORT=1433")
        print(f"DB_DATABASE={DATABASE}")
        print("\nNow run: npm run start:server")
    else:
        print("[FAIL] SQL login still not working.")
        print("\nNext step: open SSMS and manually test:")
        print(f"  Authentication: SQL Server Authentication")
        print(f"  Login: {SQL_LOGIN}")
        print(f"  Password: {SQL_PASSWORD}")
        print("If that also fails, Mixed Mode may not have saved properly.")
        print("Try: Server Properties > Security > change auth mode > OK > restart service.")


if __name__ == "__main__":
    main()