"""Seed the complete RMAA & AST fee structure."""
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'rmaa_backend.settings'
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))
django.setup()
from django.db import connection

with connection.cursor() as c:
    c.execute('DELETE FROM FeeStructure')

rows = [
    # RMAA: Membership Fees
    ('Membership Fees', 'Annual Membership - HT 100+ Units (A)', '', '9 400.00', '', 1),
    ('Membership Fees', 'Annual Membership - HT 50-99 Units (B)', '', '6 500.00', '', 2),
    ('Membership Fees', 'Annual Membership - HT 21-49 Units (C)', '', '4 800.00', '', 3),
    ('Membership Fees', 'Annual Membership - LT 11-20 Units (D)', '', '3 100.00', '', 4),
    ('Membership Fees', 'Annual Membership - LT <10 Units (E)', '', '1 600.00', '', 5),
    ('Membership Fees', 'Annual Membership - Rural Abattoirs (2 Units max)', '', '450.00', '', 6),
    ('Membership Fees', 'Annual Membership - Associated Members', '', '10 000.00', '', 7),
    ('Membership Fees', 'Modular abattoir plans', '', '1 800.00', '', 8),
    ('Membership Fees', 'Associated Membership with Price Information Package', '', '11 550.00', '', 9),

    # RMAA: Slaughter Techniques
    ('Slaughter Techniques', 'Annual 1-day Slaughter Technique Training (RT)', '', '1 430.00', '2 000.00', 10),
    ('Slaughter Techniques', 'Annual 1-day Slaughter Technique Training (LT)', '', '1 980.00', '3 410.00', 11),
    ('Slaughter Techniques', 'Annual 1-day Slaughter Technique Training (HT)', '', '2 860.00', '6 270.00', 12),
    ('Slaughter Techniques', 'Additional Slaughter Technique Training Requests (RT)', '', '2 400.00', '2 600.00', 13),
    ('Slaughter Techniques', 'Additional Slaughter Technique Training Requests (LT)', '', '3 520.00', '3 740.00', 14),
    ('Slaughter Techniques', 'Additional Slaughter Technique Training Requests (HT)', '', '4 950.00', '7 920.00', 15),
    ('Slaughter Techniques', 'Slaughter Assistance (per slaughter operator per day)', '', '3 850.00', '4 730.00', 16),

    # RMAA: Support Services
    ('Support Services', 'Support (per day at abattoir)', '', '4 700.00', '10 400.00', 17),
    ('Support Services', 'Support (per hour at office)', '', '370.00', '400.00', 18),
    ('Support Services', 'HMS Establishment (in office/on-site verification)', '', 'Individual Quotation', '', 19),
    ('Support Services', 'FSMS Establishment (in office/on-site verification)', '', 'Individual Quotation', '', 20),

    # RMAA: Contracts
    ('Contracts', '3 Day Contract - Training and/or Support Services excl FSMS (LT)', '3 Days', '8 800.00', '12 430.00', 21),
    ('Contracts', '3 Day Contract - Training and/or Support Services excl FSMS (HT)', '3 Days', '11 220.00', '22 110.00', 22),

    # RMAA: Audits
    ('Audits', 'HAS, ISO 22 000, SANS 10330, SABS 10049, ISO 14 000, ISO 18001, Certification', '', 'Individual quotations', '', 23),

    # RMAA: Laboratory
    ('Laboratory Sampling & Analysis', '2 x carcass swabs, 1 x Water, 8 x Surface Swabs, 2 x Hand swabs = TOTAL = 13 samples', '', '2 900.00', '', 24),

    # RMAA: SDF
    ('Skills Development Facilitation (SDF)', 'Completion and submission of WSP and ATR', '', 'As per SDF agreement', '', 25),

    # RMAA: Industry Information
    ('Industry Information', 'Meat Inspectors Manual: Red Meat (English or Afrikaans)', '', '280.00', '390.00', 26),
    ('Industry Information', 'Technical Information', '', 'Upon request', '', 27),
    ('Industry Information', 'RMAA Industry Guidelines', '', '600.00', '1 500.00', 28),
    ('Industry Information', 'RMAA Animal Welfare Guidelines', '', '420.00', '1 400.00', 29),
    ('Industry Information', 'Price Information - Weekly Fee', '', '140.00', '200.00', 30),
    ('Industry Information', 'Price Information - Annual Fee', '', '6 300.00', '9 400.00', 31),
    ('Industry Information', 'Abattoir Information - National list', '', 'Members Benefit', '2 600.00', 32),
    ('Industry Information', 'Abattoir Information - Provincial list', '', '', '460.00', 33),

    # RMAA: Advertisements
    ('Advertisements', 'In Diary - Annual A5 colour advertisement per page', '', '6 800.00', '8 000.00', 34),
    ('Advertisements', 'In RMAA Newsletter to Industry', '', '2 300.00', '2 800.00', 35),
    ('Advertisements', 'RMAA Web Banners or Dedicated Landing Page (3 months hosting)', '', '2 300.00', '2 800.00', 36),

    # RMAA: Annual Conference
    ('Annual Conference', 'Exhibitors: 2x3m stall with name board - Includes conference package (1.5 days) and dinners', '', '8 800.00', '10 200.00', 37),
    ('Annual Conference', 'Delegates: Conference registration fee (1.5 days) and dinners', '', '1 700.00', '2 900.00', 38),

    # AST: Learnerships
    ('Learnerships (AgriSETA)', 'NC: General Abattoir Processes', '1 Year', '30 600.00', '', 39),
    ('Learnerships (AgriSETA)', 'FETC: Meat Examination', '1 Year', '30 600.00', '', 40),

    # AST: Credit Bearing
    ('Credit Bearing (AgriSETA)', 'HMS & HACCP / ISO 22000', '4 Days', '7 100.00', '8 800.00', 41),
    ('Credit Bearing (AgriSETA)', 'Food Safety Management System Awareness', '1 Day', '1 600.00', '1 900.00', 42),
    ('Credit Bearing (AgriSETA)', 'Introductory Abattoir Hygiene', '2 Days', '3 100.00', '3 800.00', 43),
    ('Credit Bearing (AgriSETA)', 'Hygiene Awareness', '1 Day', '1 050.00', '1 500.00', 44),
    ('Credit Bearing (AgriSETA)', 'Meat Inspector (Refresher)', '2 Days', '5 700.00', '6 400.00', 45),

    # AST: Non-Credit Bearing
    ('Non-Credit Bearing', 'Practical Abattoir Skills (Hygiene Awareness, Cleaning & Sanitation, Equipment Handling, Slaughter Techniques)', '1 Day', '4 300.00', '7 100.00', 46),
    ('Non-Credit Bearing', 'Hygiene Awareness - RMAA', '1/2 Day', '860.00', '1 150.00', 47),
    ('Non-Credit Bearing', 'Practical Animal Handling', '1 Day', '860.00', '1 150.00', 48),
    ('Non-Credit Bearing', 'Basic Introduction to the Abattoir Industry', '1/2 Day', '650.00', '770.00', 49),
    ('Non-Credit Bearing', 'ISO 22000 Bridging Course', '2 Days', '5 000.00', '6 250.00', 50),
    ('Non-Credit Bearing', 'Food Safety Internal Auditors Course', '3 Days', '6 000.00', '8 500.00', 51),
    ('Non-Credit Bearing', 'Meat Inspection (Refresher) - E Learning', 'NA', '2 900.00', '2 900.00', 52),

    # AST: Workshops
    ('Workshops (per person per day)', 'Workshop', '', '1 400.00', '2 900.00', 53),

    # AST: Certificates
    ('Certificates', 'Red Meat Examiners Certificate', '6 Months', '11 400.00', '', 54),
    ('Certificates', 'Game Meat Examiner Certificate', '6 Months', '14 400.00', '', 55),
    ('Certificates', 'Abattoir Supervisor NC', '6 Months', '18 000.00', '', 56),
]

with connection.cursor() as c:
    for r in rows:
        c.execute(
            'INSERT INTO FeeStructure (category, description, days, rmaa_members, non_members, sort_order) VALUES (%s,%s,%s,%s,%s,%s)',
            list(r)
        )
print(f'Seeded {len(rows)} fee structure items')
