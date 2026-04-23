"""Column lists for each master table — ported from the Node routes.

The order matters for INSERT/UPDATE SQL. Keep in sync with `api/models.py`.
"""

ABATTOIR_COLS = [
    'abattoir_name', 'rc_nr', 'province', 'status', 'za_nr', 'expiry_date_za',
    'transformation_government', 'price_information', 'seta', 'tel_1', 'tel_2', 'fax',
    'vat_number', 'distance_from_headoffice', 'postal_address', 'city', 'postal_code',
    'municipality', 'physical_address', 'gps_1', 'gps_2', 'owner', 'owner_email',
    'owner_cell', 'manager', 'manager_email', 'manager_cell', 'training', 'training_email',
    'training_cell', 'accounts', 'accounts_email', 'accounts_cell', 'emails',
    'assignee_name', 'assignee_contact_name', 'assignee_contact_number', 'meat_inspectors',
    'meat_examiner', 'qa_manager', 'floor_supervisor', 'technical_manager', 'contact_number',
    'email', 'qc_hygiene_manager', 'cell_number', 'email_qc_hygiene', 'lh', 'g', 'units',
    'amount_slaughtered', 'cattle', 'calves', 'sheep', 'pig', 'goat', 'game', 'crocodiles',
    'horses', 'kosher', 'halaal', 'classification', 'grader', 'deboning_plant',
    'processing_plant', 'rendering_plant', 'residue', 'member_2018', 'member_2019',
    'member_2020', 'member_2021', 'member_2022', 'member_2023', 'member_2024', 'member_2025',
    'member_2026', 'other_comments', 'modified_by', 'modified_time', 'modified_fields',
    'old_values', 'new_values', 'can_mail', 'date_mail_sent', 'verification',
    'db_updated', 'latest_update_received', 'db_comment',
]
ABATTOIR_BRACKETS = {'status', 'g'}

TRANSFORMATION_COLS = [
    'abattoir_name', 'rn_nr', 'ifc', 'status', 'report_date', 'za_nr', 'expiry_date_za',
    'import_col', 'black_owned', 'transformation_abattoirs', 'contributing', 'province',
    'seta', 'tel_1', 'tel_2', 'fax', 'vat_number', 'postal_address', 'city', 'postal_code',
    'municipality', 'physical_address', 'gps_coordinates', 'blank', 'owner', 'owner_email',
    'owner_cell', 'manager', 'manager_email', 'manager_cell', 'training', 'training_email',
    'training_cell', 'accounts', 'accounts_email', 'accounts_cell', 'emails',
    'technical_manager', 'contact_number', 'email', 'qc_hygiene_manager', 'qc_hygiene_cell',
    'qc_hygiene_email', 'member_2018', 'member_2019', 'member_2020', 'member_2021',
    'member_2022', 'member_2023', 'member_2024', 'member_2025', 'kosher', 'halaal',
    'deboning_plant', 'processing_plant', 'rendering_plant', 'residue', 'lh', 'g', 'units',
    'cattle', 'calves', 'sheep', 'pig', 'goat', 'game', 'crocodiles',
    'meat_inspection_services', 'blank_1', 'blank_2', 'blank_3', 'db_updated',
    'latest_update_received', 'db_comment', 'other_comments', 'returned_email',
    'returned_email_comments', 'diaries_2022', 'calendars_2023', 'notebooks_2024',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
TRANSFORMATION_BRACKETS = {'status', 'g'}

GOVERNMENT_COLS = [
    'department', 'detail', 'name', 'tel_1', 'cellphone_number', 'email', 'position',
    'department_2', 'directorate', 'sub_directors', 'address', 'blank_1', 'town',
    'blank_2', 'notes', 'modified_by', 'modified_time', 'modified_fields',
    'old_values', 'new_values',
]
GOVERNMENT_BRACKETS: set[str] = set()

INDUSTRY_COLS = [
    'company', 'number', 'number_1', 'fax', 'vat_number', 'postal_address', 'physical_address',
    'contact_1', 'position_1', 'email_1', 'cell_1',
    'contact_2', 'position_2', 'email_2', 'cell_2',
    'contact_3', 'position_3', 'email_3', 'cell_3',
    'contact_4', 'position_4', 'email_4', 'cell_4',
    'diary_2022', 'calendar_2023',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
INDUSTRY_BRACKETS = {'number'}

ASSOCIATED_COLS = [
    'company', 'member_2017', 'member_2018', 'member_2019', 'member_2020', 'member_2021',
    'member_2022', 'member_2023', 'member_2024',
    'tel_1', 'tel_2', 'fax', 'vat_number', 'postal_address', 'physical_address',
    'contact_1', 'position_1', 'email_1', 'cell_1',
    'contact_2', 'position_2', 'email_2', 'cell_2',
    'member_2025', 'comments', 'changes', 'notebook_2024',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
ASSOCIATED_BRACKETS: set[str] = set()

STT_COLS = [
    'province', 'municipality', 'name', 'surname', 'id_number', 'year_of_birth', 'age',
    'citizen', 'race_gender', 'training_date', 'training_start_date', 'training_end_date',
    'abattoir_name', 'thru_put', 'specie',
    'work_station', 'report_to_client', 'reported_by', 'sample_take', 'lab_report_received',
    'am', 'af', 'ad', 'cm', 'cf', 'cd', 'im', 'if_', 'id_2', 'wm', 'wf', 'wd',
    'tot_m', 'tot_f', 'tot_d',
    'age_lt35', 'age_35_55', 'age_gt55', 'age_2',
    'total_race_gender', 'total_male_female', 'total_per_age_group',
    'disability',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
STT_BRACKETS = {'if_', 'id_2', 'name'}

TRAINING_COLS = [
    'province', 'municipality', 'name', 'surname', 'id_number', 'year_of_birth', 'age',
    'citizen', 'race_gender', 'training_date', 'abattoir_name', 'thru_put', 'specie',
    'work_station', 'report_to_client', 'reported_by', 'sample_take', 'lab_report_received',
    'am', 'af', 'ad', 'cm', 'cf', 'cd', 'im', 'if_', 'id_2', 'wm', 'wf', 'wd',
    'tot_m', 'tot_f', 'tot_d',
    'age_lt35', 'age_35_55', 'age_gt55', 'age_2',
    'total_race_gender', 'total_male_female', 'total_per_age_group',
    'disability',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
TRAINING_BRACKETS = {'if_', 'id_2', 'name'}

RESIDUE_ALL_COLS = [
    'record_id', 'species',
    'est_no', 'establishment', 'substance', 'specie', 'sample_type', 'sample_ref',
    'job_number', 'sample_id', 'pooled_or_single', 'farm_name', 'district', 'state_vet_area',
    'province', 'authorised_person', 'owner', 'authority_sampling', 'date_collected',
    'date_signed', 'date_received_lab', 'date_registered', 'date_captured',
    'reason_not_analysed',
    'date_completed_1', 'date_completed_2', 'date_completed_3',
    'date_completed_4', 'date_completed_5', 'date_completed_6', 'date_completed_7',
    'results_1', 'substance_results_1', 'ppb_results_1',
    'results_2', 'substance_results_2', 'ppb_results_2',
    'results_3', 'substance_results_3', 'ppb_results_3',
    'results_4', 'substance_results_4', 'ppb_results_4',
    'results_5', 'substance_results_5', 'ppb_results_5',
    'results_6', 'substance_results_6', 'ppb_results_6',
    'results_7', 'substance_results_7', 'ppb_results_7',
    'comments', 'non_compliant', 'cost_screening', 'cost_confirmation', 'admin_cost',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]

RESIDUE_INSERT_COLS = [
    'record_id', 'species',
    'est_no', 'establishment', 'substance', 'specie', 'sample_type', 'sample_ref',
    'job_number', 'sample_id', 'pooled_or_single', 'farm_name', 'district', 'state_vet_area',
    'province', 'authorised_person', 'owner', 'authority_sampling', 'date_collected',
    'date_signed', 'date_received_lab', 'date_registered', 'date_captured',
    'reason_not_analysed',
    'date_completed_1', 'date_completed_2', 'date_completed_3',
    'date_completed_4', 'date_completed_5', 'date_completed_6', 'date_completed_7',
    'results_1', 'results_2', 'results_3', 'results_4', 'results_5', 'results_6', 'results_7',
    'comments', 'non_compliant', 'cost_screening', 'cost_confirmation', 'admin_cost',
]

# Header order for the Residue upload Excel (the first data column matches HEADER_MAP[0])
RESIDUE_HEADER_MAP = [
    'est_no', 'establishment', 'substance', 'specie', 'sample_type',
    'sample_ref', 'job_number', 'sample_id', 'pooled_or_single', 'farm_name',
    'district', 'state_vet_area', 'province', 'authorised_person', 'owner',
    'authority_sampling', 'date_collected', 'date_signed', 'date_received_lab',
    'date_registered', 'date_captured', 'reason_not_analysed',
    'date_completed_1', 'date_completed_2', 'date_completed_3',
    'date_completed_4', 'date_completed_5', 'date_completed_6', 'date_completed_7',
    'results_1', 'results_2', 'results_3', 'results_4', 'results_5',
    'results_6', 'results_7', 'comments', 'non_compliant',
    'cost_screening', 'cost_confirmation', 'admin_cost',
]

FEE_STRUCTURE_COLS = [
    'category', 'description', 'days', 'rmaa_members', 'non_members', 'sort_order',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
FEE_STRUCTURE_BRACKETS = set()

LEARNER_COLS = [
    'name', 'surname', 'id_number', 'year_of_birth', 'age', 'citizen',
    'race_gender', 'work_stations',
    'modified_by', 'modified_time', 'modified_fields', 'old_values', 'new_values',
]
LEARNER_BRACKETS = set()

AUDIT_NAME_JOIN = {
    'STTTrainingReport': ('STTTrainingReport', 'abattoir_name'),
    'AbattoirMaster': ('AbattoirMaster', 'abattoir_name'),
    'TransformationMaster': ('TransformationMaster', 'abattoir_name'),
    'GovernmentMaster': ('GovernmentMaster', 'department'),
    'IndustryMaster': ('IndustryMaster', 'company'),
    'AssociatedMembersMaster': ('AssociatedMembersMaster', 'company'),
    'ResidueMonitoring': ('ResidueMonitoring', 'establishment'),
    'Learners': ('Learners', 'surname'),
    'FeeStructure': ('FeeStructure', 'description'),
}
