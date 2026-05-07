/**
 * Derive Date of Birth and Age from a South African ID number.
 * SA ID format: YYMMDD GSSS CAZ
 *   - First 6 digits = date of birth (YYMMDD)
 *   - Century: YY > current 2-digit year → 1900s, else 2000s
 *
 * @param {string} idNumber
 * @returns {{ year_of_birth: string, age: string } | null}
 */
export function deriveDobAge(idNumber) {
  const cleaned = (idNumber || '').replace(/\s/g, '');
  if (cleaned.length < 6 || !/^\d{6}/.test(cleaned)) return null;

  const yy = parseInt(cleaned.substring(0, 2), 10);
  const mm = parseInt(cleaned.substring(2, 4), 10);
  const dd = parseInt(cleaned.substring(4, 6), 10);

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const currentYear2 = new Date().getFullYear() % 100;
  const century = yy > currentYear2 ? 1900 : 2000;
  const fullYear = century + yy;

  const dob = new Date(fullYear, mm - 1, dd);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - fullYear;
  const monthDiff = today.getMonth() - (mm - 1);
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dd)) {
    age--;
  }

  return {
    year_of_birth: `${dd.toString().padStart(2, '0')}/${mm.toString().padStart(2, '0')}/${fullYear}`,
    age: String(age),
  };
}
