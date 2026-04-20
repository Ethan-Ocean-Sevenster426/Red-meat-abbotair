import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

export const dbConfig = {
  user:     process.env.DB_USER     || 'Anthony',
  password: process.env.DB_PASSWORD || 'StrongPassword123!',
  server:   process.env.DB_SERVER   || 'localhost',
  port:     parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE || 'RMAAAuthDB',
  options: {
    encrypt:              false,
    trustServerCertificate: true,
    enableArithAbort:     true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

export let pool = null;

const RESIDUE_COLUMNS = `
  record_id NVARCHAR(64) NOT NULL,
  species NVARCHAR(50),
  est_no NVARCHAR(100),
  establishment NVARCHAR(255),
  substance NVARCHAR(100),
  specie NVARCHAR(100),
  sample_type NVARCHAR(100),
  sample_ref NVARCHAR(100),
  job_number NVARCHAR(100),
  sample_id NVARCHAR(100),
  pooled_or_single NVARCHAR(50),
  farm_name NVARCHAR(255),
  district NVARCHAR(255),
  state_vet_area NVARCHAR(255),
  province NVARCHAR(255),
  authorised_person NVARCHAR(255),
  owner NVARCHAR(255),
  authority_sampling NVARCHAR(255),
  date_collected NVARCHAR(50),
  date_signed NVARCHAR(50),
  date_received_lab NVARCHAR(50),
  date_registered NVARCHAR(50),
  date_captured NVARCHAR(50),
  reason_not_analysed NVARCHAR(500),
  date_completed_1 NVARCHAR(50),
  date_completed_2 NVARCHAR(50),
  date_completed_3 NVARCHAR(50),
  date_completed_4 NVARCHAR(50),
  date_completed_5 NVARCHAR(50),
  date_completed_6 NVARCHAR(50),
  date_completed_7 NVARCHAR(50),
  results_1 NVARCHAR(200),
  substance_results_1 NVARCHAR(200),
  ppb_results_1 NVARCHAR(200),
  results_2 NVARCHAR(200),
  substance_results_2 NVARCHAR(200),
  ppb_results_2 NVARCHAR(200),
  results_3 NVARCHAR(200),
  substance_results_3 NVARCHAR(200),
  ppb_results_3 NVARCHAR(200),
  results_4 NVARCHAR(200),
  substance_results_4 NVARCHAR(200),
  ppb_results_4 NVARCHAR(200),
  results_5 NVARCHAR(200),
  substance_results_5 NVARCHAR(200),
  ppb_results_5 NVARCHAR(200),
  results_6 NVARCHAR(200),
  substance_results_6 NVARCHAR(200),
  ppb_results_6 NVARCHAR(200),
  results_7 NVARCHAR(200),
  substance_results_7 NVARCHAR(200),
  ppb_results_7 NVARCHAR(200),
  comments NVARCHAR(1000),
  non_compliant NVARCHAR(100),
  cost_screening NVARCHAR(50),
  cost_confirmation NVARCHAR(50),
  admin_cost NVARCHAR(50),
  modified_by NVARCHAR(255),
  modified_time NVARCHAR(100),
  modified_fields NVARCHAR(MAX),
  old_values NVARCHAR(MAX),
  new_values NVARCHAR(MAX)
`;

export async function initDb() {
  pool = await sql.connect(dbConfig);
  console.log('✔ Connected to SQL Server');

  // Ensure DB exists
  await pool.request().query(`
    IF DB_ID(N'RMAAAuthDB') IS NULL CREATE DATABASE RMAAAuthDB;
  `);
  if (pool.config.database !== 'RMAAAuthDB') {
    await sql.close();
    pool = await sql.connect(dbConfig);
  }

  // Users table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(100) UNIQUE NOT NULL,
        password NVARCHAR(200) NOT NULL,
        role NVARCHAR(50) NOT NULL,
        displayName NVARCHAR(150) NOT NULL
      );
    END
  `);

  // Add email column if missing
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'email')
      ALTER TABLE dbo.Users ADD email NVARCHAR(255) NULL;
  `);

  // Seed / update users
  await pool.request().query(`
    -- Anthony: upsert with email login
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'Anthony')
      UPDATE dbo.Users SET password = 'Admin', email = 'Anthony.Penzes@moc-pty.com', displayName = 'Anthony Penzes' WHERE username = 'Anthony';
    ELSE
      INSERT INTO dbo.Users (username, password, role, displayName, email) VALUES ('Anthony','Admin','admin','Anthony Penzes','Anthony.Penzes@moc-pty.com');

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'admin')
      INSERT INTO dbo.Users (username, password, role, displayName, email) VALUES ('admin','admin123','admin','Admin User','admin@rmaa.co.za');
    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE username = 'user')
      INSERT INTO dbo.Users (username, password, role, displayName, email) VALUES ('user','user123','user','Standard User','user@rmaa.co.za');
  `);

  // ResidueMonitoringTemp
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ResidueMonitoringTemp]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.ResidueMonitoringTemp (
        id INT IDENTITY(1,1) PRIMARY KEY,
        batch_id NVARCHAR(50) NOT NULL,
        uploaded_at DATETIME DEFAULT GETDATE(),
        ${RESIDUE_COLUMNS}
      );
    END
  `);

  // ResidueMonitoring (final)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ResidueMonitoring]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.ResidueMonitoring (
        id INT IDENTITY(1,1) PRIMARY KEY,
        committed_at DATETIME DEFAULT GETDATE(),
        ${RESIDUE_COLUMNS}
      );
    END
  `);

  // Migrations
  for (const table of ['ResidueMonitoringTemp', 'ResidueMonitoring']) {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'record_id')
        ALTER TABLE dbo.${table} ADD record_id NVARCHAR(64) NOT NULL DEFAULT '';
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'species')
        ALTER TABLE dbo.${table} ADD species NVARCHAR(50) NULL;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'sheet_name')
        ALTER TABLE dbo.${table} DROP COLUMN sheet_name;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'non_compliant' AND max_length < 200)
        ALTER TABLE dbo.${table} ALTER COLUMN non_compliant NVARCHAR(100);
    `);

    // Add substance_results and ppb_results columns
    for (let n = 1; n <= 7; n++) {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'substance_results_${n}')
          ALTER TABLE dbo.${table} ADD substance_results_${n} NVARCHAR(200) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'ppb_results_${n}')
          ALTER TABLE dbo.${table} ADD ppb_results_${n} NVARCHAR(200) NULL;
      `);
    }

    // Add modified audit columns
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'modified_by')
        ALTER TABLE dbo.${table} ADD modified_by NVARCHAR(255) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'modified_time')
        ALTER TABLE dbo.${table} ADD modified_time NVARCHAR(100) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'modified_fields')
        ALTER TABLE dbo.${table} ADD modified_fields NVARCHAR(MAX) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'old_values')
        ALTER TABLE dbo.${table} ADD old_values NVARCHAR(MAX) NULL;
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.${table}') AND name = 'new_values')
        ALTER TABLE dbo.${table} ADD new_values NVARCHAR(MAX) NULL;
    `);
  }

  // AbattoirMaster table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AbattoirMaster]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.AbattoirMaster (
        id INT IDENTITY(1,1) PRIMARY KEY,
        abattoir_name NVARCHAR(255),
        rc_nr NVARCHAR(50),
        province NVARCHAR(100),
        [status] NVARCHAR(50),
        za_nr NVARCHAR(100),
        expiry_date_za NVARCHAR(100),
        transformation_government NVARCHAR(255),
        price_information NVARCHAR(255),
        seta NVARCHAR(255),
        tel_1 NVARCHAR(100),
        tel_2 NVARCHAR(100),
        fax NVARCHAR(100),
        vat_number NVARCHAR(100),
        distance_from_headoffice NVARCHAR(100),
        postal_address NVARCHAR(500),
        city NVARCHAR(255),
        postal_code NVARCHAR(50),
        municipality NVARCHAR(255),
        physical_address NVARCHAR(500),
        gps_1 NVARCHAR(255),
        gps_2 NVARCHAR(255),
        owner NVARCHAR(255),
        owner_email NVARCHAR(255),
        owner_cell NVARCHAR(100),
        manager NVARCHAR(255),
        manager_email NVARCHAR(255),
        manager_cell NVARCHAR(100),
        training NVARCHAR(255),
        training_email NVARCHAR(255),
        training_cell NVARCHAR(100),
        accounts NVARCHAR(255),
        accounts_email NVARCHAR(255),
        accounts_cell NVARCHAR(100),
        emails NVARCHAR(500),
        assignee_name NVARCHAR(255),
        assignee_contact_name NVARCHAR(255),
        assignee_contact_number NVARCHAR(100),
        meat_inspectors NVARCHAR(500),
        meat_examiner NVARCHAR(255),
        qa_manager NVARCHAR(255),
        floor_supervisor NVARCHAR(255),
        technical_manager NVARCHAR(255),
        contact_number NVARCHAR(100),
        email NVARCHAR(255),
        qc_hygiene_manager NVARCHAR(255),
        cell_number NVARCHAR(100),
        email_qc_hygiene NVARCHAR(255),
        lh NVARCHAR(50),
        g NVARCHAR(50),
        units NVARCHAR(50),
        amount_slaughtered NVARCHAR(100),
        cattle NVARCHAR(50),
        calves NVARCHAR(50),
        sheep NVARCHAR(50),
        pig NVARCHAR(50),
        goat NVARCHAR(50),
        game NVARCHAR(50),
        crocodiles NVARCHAR(50),
        horses NVARCHAR(50),
        kosher NVARCHAR(50),
        halaal NVARCHAR(50),
        classification NVARCHAR(50),
        grader NVARCHAR(100),
        deboning_plant NVARCHAR(50),
        processing_plant NVARCHAR(50),
        rendering_plant NVARCHAR(50),
        residue NVARCHAR(50),
        member_2018 NVARCHAR(50),
        member_2019 NVARCHAR(50),
        member_2020 NVARCHAR(50),
        member_2021 NVARCHAR(50),
        member_2022 NVARCHAR(50),
        member_2023 NVARCHAR(50),
        member_2024 NVARCHAR(50),
        member_2025 NVARCHAR(50),
        member_2026 NVARCHAR(50),
        other_comments NVARCHAR(MAX),
        modified_by NVARCHAR(255),
        modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values NVARCHAR(MAX),
        new_values NVARCHAR(MAX),
        can_mail NVARCHAR(50),
        date_mail_sent NVARCHAR(100),
        verification NVARCHAR(100),
        db_updated NVARCHAR(100),
        latest_update_received NVARCHAR(255),
        db_comment NVARCHAR(MAX)
      );
    END
  `);

  // TransformationMaster table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TransformationMaster]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.TransformationMaster (
        id INT IDENTITY(1,1) PRIMARY KEY,
        abattoir_name NVARCHAR(255),
        rn_nr NVARCHAR(50),
        ifc NVARCHAR(100),
        [status] NVARCHAR(50),
        report_date NVARCHAR(100),
        za_nr NVARCHAR(100),
        expiry_date_za NVARCHAR(100),
        import_col NVARCHAR(255),
        black_owned NVARCHAR(50),
        transformation_abattoirs NVARCHAR(50),
        contributing NVARCHAR(50),
        province NVARCHAR(100),
        seta NVARCHAR(100),
        tel_1 NVARCHAR(100),
        tel_2 NVARCHAR(100),
        fax NVARCHAR(100),
        vat_number NVARCHAR(100),
        postal_address NVARCHAR(500),
        city NVARCHAR(255),
        postal_code NVARCHAR(50),
        municipality NVARCHAR(255),
        physical_address NVARCHAR(500),
        gps_coordinates NVARCHAR(255),
        blank NVARCHAR(255),
        owner NVARCHAR(255),
        owner_email NVARCHAR(255),
        owner_cell NVARCHAR(100),
        manager NVARCHAR(255),
        manager_email NVARCHAR(255),
        manager_cell NVARCHAR(100),
        training NVARCHAR(255),
        training_email NVARCHAR(255),
        training_cell NVARCHAR(100),
        accounts NVARCHAR(255),
        accounts_email NVARCHAR(255),
        accounts_cell NVARCHAR(100),
        emails NVARCHAR(500),
        technical_manager NVARCHAR(255),
        contact_number NVARCHAR(100),
        email NVARCHAR(255),
        qc_hygiene_manager NVARCHAR(255),
        qc_hygiene_cell NVARCHAR(100),
        qc_hygiene_email NVARCHAR(255),
        member_2018 NVARCHAR(50),
        member_2019 NVARCHAR(50),
        member_2020 NVARCHAR(50),
        member_2021 NVARCHAR(50),
        member_2022 NVARCHAR(50),
        member_2023 NVARCHAR(50),
        member_2024 NVARCHAR(50),
        member_2025 NVARCHAR(50),
        kosher NVARCHAR(50),
        halaal NVARCHAR(50),
        deboning_plant NVARCHAR(50),
        processing_plant NVARCHAR(50),
        rendering_plant NVARCHAR(50),
        residue NVARCHAR(50),
        lh NVARCHAR(50),
        g NVARCHAR(50),
        units NVARCHAR(50),
        cattle NVARCHAR(50),
        calves NVARCHAR(50),
        sheep NVARCHAR(50),
        pig NVARCHAR(50),
        goat NVARCHAR(50),
        game NVARCHAR(50),
        crocodiles NVARCHAR(50),
        meat_inspection_services NVARCHAR(255),
        blank_1 NVARCHAR(255),
        blank_2 NVARCHAR(255),
        blank_3 NVARCHAR(255),
        db_updated NVARCHAR(100),
        latest_update_received NVARCHAR(255),
        db_comment NVARCHAR(MAX),
        other_comments NVARCHAR(MAX),
        returned_email NVARCHAR(255),
        returned_email_comments NVARCHAR(MAX),
        diaries_2022 NVARCHAR(500),
        calendars_2023 NVARCHAR(500),
        notebooks_2024 NVARCHAR(100),
        modified_by NVARCHAR(255),
        modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values NVARCHAR(MAX),
        new_values NVARCHAR(MAX)
      );
    END
  `);

  // GovernmentMaster table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GovernmentMaster]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.GovernmentMaster (
        id INT IDENTITY(1,1) PRIMARY KEY,
        department NVARCHAR(255),
        detail NVARCHAR(100),
        name NVARCHAR(255),
        tel_1 NVARCHAR(100),
        cellphone_number NVARCHAR(100),
        email NVARCHAR(255),
        position NVARCHAR(255),
        department_2 NVARCHAR(255),
        directorate NVARCHAR(255),
        sub_directors NVARCHAR(255),
        address NVARCHAR(500),
        blank_1 NVARCHAR(255),
        town NVARCHAR(255),
        blank_2 NVARCHAR(255),
        notes NVARCHAR(MAX),
        modified_by NVARCHAR(255),
        modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values NVARCHAR(MAX),
        new_values NVARCHAR(MAX)
      );
    END
  `);

  // IndustryMaster table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[IndustryMaster]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.IndustryMaster (
        id INT IDENTITY(1,1) PRIMARY KEY,
        company NVARCHAR(500),
        [number] NVARCHAR(200),
        number_1 NVARCHAR(200),
        fax NVARCHAR(200),
        vat_number NVARCHAR(200),
        postal_address NVARCHAR(500),
        physical_address NVARCHAR(500),
        contact_1 NVARCHAR(300),
        position_1 NVARCHAR(300),
        email_1 NVARCHAR(300),
        cell_1 NVARCHAR(200),
        contact_2 NVARCHAR(300),
        position_2 NVARCHAR(300),
        email_2 NVARCHAR(300),
        cell_2 NVARCHAR(200),
        contact_3 NVARCHAR(300),
        position_3 NVARCHAR(300),
        email_3 NVARCHAR(300),
        cell_3 NVARCHAR(200),
        contact_4 NVARCHAR(300),
        position_4 NVARCHAR(300),
        email_4 NVARCHAR(300),
        cell_4 NVARCHAR(200),
        diary_2022 NVARCHAR(200),
        calendar_2023 NVARCHAR(200),
        modified_by NVARCHAR(255),
        modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values NVARCHAR(MAX),
        new_values NVARCHAR(MAX)
      );
    END
  `);

  // AssociatedMembersMaster table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AssociatedMembersMaster]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.AssociatedMembersMaster (
        id INT IDENTITY(1,1) PRIMARY KEY,
        company NVARCHAR(500),
        member_2017 NVARCHAR(200),
        member_2018 NVARCHAR(200),
        member_2019 NVARCHAR(200),
        member_2020 NVARCHAR(200),
        member_2021 NVARCHAR(200),
        member_2022 NVARCHAR(200),
        member_2023 NVARCHAR(200),
        member_2024 NVARCHAR(200),
        tel_1 NVARCHAR(200),
        tel_2 NVARCHAR(200),
        fax NVARCHAR(200),
        vat_number NVARCHAR(200),
        postal_address NVARCHAR(500),
        physical_address NVARCHAR(500),
        contact_1 NVARCHAR(300),
        position_1 NVARCHAR(300),
        email_1 NVARCHAR(300),
        cell_1 NVARCHAR(200),
        contact_2 NVARCHAR(300),
        position_2 NVARCHAR(300),
        email_2 NVARCHAR(300),
        cell_2 NVARCHAR(200),
        member_2025 NVARCHAR(200),
        comments NVARCHAR(MAX),
        changes NVARCHAR(MAX),
        notebook_2024 NVARCHAR(200),
        modified_by NVARCHAR(255),
        modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values NVARCHAR(MAX),
        new_values NVARCHAR(MAX)
      );
    END
  `);

  // AuditLog table — full change history across all tables
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AuditLog]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.AuditLog (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        table_name      NVARCHAR(100) NOT NULL,
        record_id       INT NOT NULL,
        modified_by     NVARCHAR(500),
        modified_time   NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values      NVARCHAR(MAX),
        new_values      NVARCHAR(MAX),
        created_at      DATETIME2 DEFAULT GETDATE()
      );
      CREATE INDEX IX_AuditLog_record ON dbo.AuditLog(table_name, record_id);
    END
  `);

  // Invitations table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Invitations]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.Invitations (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        token       NVARCHAR(100) NOT NULL UNIQUE,
        email       NVARCHAR(255) NOT NULL,
        user_id     INT NOT NULL,
        invited_by  NVARCHAR(150),
        created_at  DATETIME2 DEFAULT GETDATE(),
        expires_at  NVARCHAR(50),
        accepted    BIT DEFAULT 0,
        accepted_at DATETIME2 NULL
      );
    END
  `);

  // permissions column on Users
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'permissions')
      ALTER TABLE dbo.Users ADD permissions NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'created_at')
      ALTER TABLE dbo.Users ADD created_at DATETIME2 DEFAULT GETDATE();
  `);

  // TrainingReport table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TrainingReport]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.TrainingReport (
        id INT IDENTITY(1,1) PRIMARY KEY,
        province NVARCHAR(255),
        municipality NVARCHAR(255),
        name NVARCHAR(255),
        surname NVARCHAR(255),
        id_number NVARCHAR(255),
        year_of_birth NVARCHAR(50),
        age NVARCHAR(50),
        citizen NVARCHAR(255),
        race_gender NVARCHAR(255),
        training_date NVARCHAR(100),
        abattoir_name NVARCHAR(255),
        thru_put NVARCHAR(100),
        specie NVARCHAR(255),
        work_station NVARCHAR(255),
        report_to_client NVARCHAR(255),
        reported_by NVARCHAR(255),
        sample_take NVARCHAR(255),
        lab_report_received NVARCHAR(255),
        am NVARCHAR(10),
        af NVARCHAR(10),
        ad NVARCHAR(10),
        cm NVARCHAR(10),
        cf NVARCHAR(10),
        cd NVARCHAR(10),
        im NVARCHAR(10),
        if_ NVARCHAR(10),
        id_2 NVARCHAR(10),
        wm NVARCHAR(10),
        wf NVARCHAR(10),
        wd NVARCHAR(10),
        tot_m NVARCHAR(10),
        tot_f NVARCHAR(10),
        tot_d NVARCHAR(10),
        age_lt35 NVARCHAR(10),
        age_35_55 NVARCHAR(10),
        age_gt55 NVARCHAR(10),
        age_2 NVARCHAR(100),
        total_race_gender NVARCHAR(10),
        total_male_female NVARCHAR(10),
        total_per_age_group NVARCHAR(10),
        disability NVARCHAR(50),
        modified_by NVARCHAR(255),
        modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX),
        old_values NVARCHAR(MAX),
        new_values NVARCHAR(MAX)
      );
    END
  `);

  // TrainingReport migrations — add any missing columns
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'province')
      ALTER TABLE dbo.TrainingReport ADD province NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'municipality')
      ALTER TABLE dbo.TrainingReport ADD municipality NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'name')
      ALTER TABLE dbo.TrainingReport ADD name NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'surname')
      ALTER TABLE dbo.TrainingReport ADD surname NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'id_number')
      ALTER TABLE dbo.TrainingReport ADD id_number NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'year_of_birth')
      ALTER TABLE dbo.TrainingReport ADD year_of_birth NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'age')
      ALTER TABLE dbo.TrainingReport ADD age NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'citizen')
      ALTER TABLE dbo.TrainingReport ADD citizen NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'race_gender')
      ALTER TABLE dbo.TrainingReport ADD race_gender NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'training_date')
      ALTER TABLE dbo.TrainingReport ADD training_date NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'abattoir_name')
      ALTER TABLE dbo.TrainingReport ADD abattoir_name NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'thru_put')
      ALTER TABLE dbo.TrainingReport ADD thru_put NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'specie')
      ALTER TABLE dbo.TrainingReport ADD specie NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'work_station')
      ALTER TABLE dbo.TrainingReport ADD work_station NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'report_to_client')
      ALTER TABLE dbo.TrainingReport ADD report_to_client NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'reported_by')
      ALTER TABLE dbo.TrainingReport ADD reported_by NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'sample_take')
      ALTER TABLE dbo.TrainingReport ADD sample_take NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'lab_report_received')
      ALTER TABLE dbo.TrainingReport ADD lab_report_received NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'am')
      ALTER TABLE dbo.TrainingReport ADD am NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'af')
      ALTER TABLE dbo.TrainingReport ADD af NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'ad')
      ALTER TABLE dbo.TrainingReport ADD ad NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'cm')
      ALTER TABLE dbo.TrainingReport ADD cm NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'cf')
      ALTER TABLE dbo.TrainingReport ADD cf NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'cd')
      ALTER TABLE dbo.TrainingReport ADD cd NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'im')
      ALTER TABLE dbo.TrainingReport ADD im NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'if_')
      ALTER TABLE dbo.TrainingReport ADD if_ NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'id_2')
      ALTER TABLE dbo.TrainingReport ADD id_2 NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'wm')
      ALTER TABLE dbo.TrainingReport ADD wm NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'wf')
      ALTER TABLE dbo.TrainingReport ADD wf NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'wd')
      ALTER TABLE dbo.TrainingReport ADD wd NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'tot_m')
      ALTER TABLE dbo.TrainingReport ADD tot_m NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'tot_f')
      ALTER TABLE dbo.TrainingReport ADD tot_f NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'tot_d')
      ALTER TABLE dbo.TrainingReport ADD tot_d NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'age_lt35')
      ALTER TABLE dbo.TrainingReport ADD age_lt35 NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'age_35_55')
      ALTER TABLE dbo.TrainingReport ADD age_35_55 NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'age_gt55')
      ALTER TABLE dbo.TrainingReport ADD age_gt55 NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'age_2')
      ALTER TABLE dbo.TrainingReport ADD age_2 NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'total_race_gender')
      ALTER TABLE dbo.TrainingReport ADD total_race_gender NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'total_male_female')
      ALTER TABLE dbo.TrainingReport ADD total_male_female NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'total_per_age_group')
      ALTER TABLE dbo.TrainingReport ADD total_per_age_group NVARCHAR(10) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'disability')
      ALTER TABLE dbo.TrainingReport ADD disability NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'modified_by')
      ALTER TABLE dbo.TrainingReport ADD modified_by NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'modified_time')
      ALTER TABLE dbo.TrainingReport ADD modified_time NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'modified_fields')
      ALTER TABLE dbo.TrainingReport ADD modified_fields NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'old_values')
      ALTER TABLE dbo.TrainingReport ADD old_values NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TrainingReport') AND name = 'new_values')
      ALTER TABLE dbo.TrainingReport ADD new_values NVARCHAR(MAX) NULL;
  `);

  // UserColumnPreferences table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserColumnPreferences]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.UserColumnPreferences (
        user_id    INT          NOT NULL,
        page_name  NVARCHAR(100) NOT NULL,
        hidden_columns NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        PRIMARY KEY (user_id, page_name)
      );
    END
  `);

  // STTTrainingReport — migrate new date columns if table already exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.STTTrainingReport') AND name = 'training_start_date')
      ALTER TABLE dbo.STTTrainingReport ADD training_start_date NVARCHAR(100) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.STTTrainingReport') AND name = 'training_end_date')
      ALTER TABLE dbo.STTTrainingReport ADD training_end_date NVARCHAR(100) NULL;
  `);

  // STTTrainingReport table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[STTTrainingReport]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.STTTrainingReport (
        id INT IDENTITY PRIMARY KEY,
        province NVARCHAR(255), municipality NVARCHAR(255), name NVARCHAR(255), surname NVARCHAR(255),
        id_number NVARCHAR(255), year_of_birth NVARCHAR(50), age NVARCHAR(50), citizen NVARCHAR(255),
        race_gender NVARCHAR(255), training_date NVARCHAR(100), training_start_date NVARCHAR(100), training_end_date NVARCHAR(100), abattoir_name NVARCHAR(255),
        thru_put NVARCHAR(100), specie NVARCHAR(255), work_station NVARCHAR(255),
        report_to_client NVARCHAR(255), reported_by NVARCHAR(255), sample_take NVARCHAR(255),
        lab_report_received NVARCHAR(255),
        am NVARCHAR(10), af NVARCHAR(10), ad NVARCHAR(10),
        cm NVARCHAR(10), cf NVARCHAR(10), cd NVARCHAR(10),
        im NVARCHAR(10), if_ NVARCHAR(10), id_2 NVARCHAR(10),
        wm NVARCHAR(10), wf NVARCHAR(10), wd NVARCHAR(10),
        tot_m NVARCHAR(10), tot_f NVARCHAR(10), tot_d NVARCHAR(10),
        age_lt35 NVARCHAR(10), age_35_55 NVARCHAR(10), age_gt55 NVARCHAR(10), age_2 NVARCHAR(100),
        total_race_gender NVARCHAR(10), total_male_female NVARCHAR(10), total_per_age_group NVARCHAR(10),
        disability NVARCHAR(50),
        modified_by NVARCHAR(255), modified_time NVARCHAR(100),
        modified_fields NVARCHAR(MAX), old_values NVARCHAR(MAX), new_values NVARCHAR(MAX)
      );
    END
  `);

  // CustomAbattoirs table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CustomAbattoirs]') AND type = N'U')
    BEGIN
      CREATE TABLE dbo.CustomAbattoirs (
        id INT IDENTITY PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE()
      );
    END
  `);

  console.log('✔ All tables verified/migrated');
}

export async function testDb() {
  const checks = [];
  try {
    const versionResult = await pool.request().query('SELECT @@VERSION AS version');
    checks.push({ check: 'SQL Server version', ok: true, detail: versionResult.recordset[0].version.split('\n')[0] });

    for (const table of ['Users', 'ResidueMonitoringTemp', 'ResidueMonitoring']) {
      const r = await pool.request().query(
        `SELECT COUNT(*) AS cnt FROM dbo.${table}`
      );
      checks.push({ check: `Table dbo.${table}`, ok: true, detail: `${r.recordset[0].cnt} rows` });
    }
  } catch (err) {
    checks.push({ check: 'DB test', ok: false, detail: err.message });
  }
  return checks;
}
