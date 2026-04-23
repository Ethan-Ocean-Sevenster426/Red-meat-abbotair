"""Django models matching the MSSQL schema from server/db.js.

Everything is CharField/TextField because the original system treated all
inputs as strings — the frontend assumes that shape.
"""
from django.db import models


class AuditFieldsMixin(models.Model):
    modified_by = models.CharField(max_length=255, null=True, blank=True)
    modified_time = models.CharField(max_length=100, null=True, blank=True)
    modified_fields = models.TextField(null=True, blank=True)
    old_values = models.TextField(null=True, blank=True)
    new_values = models.TextField(null=True, blank=True)

    class Meta:
        abstract = True


class User(models.Model):
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=200)
    role = models.CharField(max_length=50)
    display_name = models.CharField(max_length=150, db_column='displayName')
    email = models.CharField(max_length=255, null=True, blank=True)
    permissions = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'Users'


class Invitation(models.Model):
    token = models.CharField(max_length=100, unique=True)
    email = models.CharField(max_length=255)
    user_id = models.IntegerField()
    invited_by = models.CharField(max_length=150, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    expires_at = models.CharField(max_length=50, null=True, blank=True)
    accepted = models.BooleanField(default=False)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'Invitations'


class AbattoirMaster(AuditFieldsMixin):
    abattoir_name = models.CharField(max_length=255, null=True, blank=True)
    rc_nr = models.CharField(max_length=50, null=True, blank=True)
    province = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, null=True, blank=True)
    za_nr = models.CharField(max_length=100, null=True, blank=True)
    expiry_date_za = models.CharField(max_length=100, null=True, blank=True)
    transformation_government = models.CharField(max_length=255, null=True, blank=True)
    price_information = models.CharField(max_length=255, null=True, blank=True)
    seta = models.CharField(max_length=255, null=True, blank=True)
    tel_1 = models.CharField(max_length=100, null=True, blank=True)
    tel_2 = models.CharField(max_length=100, null=True, blank=True)
    fax = models.CharField(max_length=100, null=True, blank=True)
    vat_number = models.CharField(max_length=100, null=True, blank=True)
    distance_from_headoffice = models.CharField(max_length=100, null=True, blank=True)
    postal_address = models.CharField(max_length=500, null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    postal_code = models.CharField(max_length=50, null=True, blank=True)
    municipality = models.CharField(max_length=255, null=True, blank=True)
    physical_address = models.CharField(max_length=500, null=True, blank=True)
    gps_1 = models.CharField(max_length=255, null=True, blank=True)
    gps_2 = models.CharField(max_length=255, null=True, blank=True)
    owner = models.CharField(max_length=255, null=True, blank=True)
    owner_email = models.CharField(max_length=255, null=True, blank=True)
    owner_cell = models.CharField(max_length=100, null=True, blank=True)
    manager = models.CharField(max_length=255, null=True, blank=True)
    manager_email = models.CharField(max_length=255, null=True, blank=True)
    manager_cell = models.CharField(max_length=100, null=True, blank=True)
    training = models.CharField(max_length=255, null=True, blank=True)
    training_email = models.CharField(max_length=255, null=True, blank=True)
    training_cell = models.CharField(max_length=100, null=True, blank=True)
    accounts = models.CharField(max_length=255, null=True, blank=True)
    accounts_email = models.CharField(max_length=255, null=True, blank=True)
    accounts_cell = models.CharField(max_length=100, null=True, blank=True)
    emails = models.CharField(max_length=500, null=True, blank=True)
    assignee_name = models.CharField(max_length=255, null=True, blank=True)
    assignee_contact_name = models.CharField(max_length=255, null=True, blank=True)
    assignee_contact_number = models.CharField(max_length=100, null=True, blank=True)
    meat_inspectors = models.CharField(max_length=500, null=True, blank=True)
    meat_examiner = models.CharField(max_length=255, null=True, blank=True)
    qa_manager = models.CharField(max_length=255, null=True, blank=True)
    floor_supervisor = models.CharField(max_length=255, null=True, blank=True)
    technical_manager = models.CharField(max_length=255, null=True, blank=True)
    contact_number = models.CharField(max_length=100, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    qc_hygiene_manager = models.CharField(max_length=255, null=True, blank=True)
    cell_number = models.CharField(max_length=100, null=True, blank=True)
    email_qc_hygiene = models.CharField(max_length=255, null=True, blank=True)
    lh = models.CharField(max_length=50, null=True, blank=True)
    g = models.CharField(max_length=50, null=True, blank=True)
    units = models.CharField(max_length=50, null=True, blank=True)
    amount_slaughtered = models.CharField(max_length=100, null=True, blank=True)
    cattle = models.CharField(max_length=50, null=True, blank=True)
    calves = models.CharField(max_length=50, null=True, blank=True)
    sheep = models.CharField(max_length=50, null=True, blank=True)
    pig = models.CharField(max_length=50, null=True, blank=True)
    goat = models.CharField(max_length=50, null=True, blank=True)
    game = models.CharField(max_length=50, null=True, blank=True)
    crocodiles = models.CharField(max_length=50, null=True, blank=True)
    horses = models.CharField(max_length=50, null=True, blank=True)
    kosher = models.CharField(max_length=50, null=True, blank=True)
    halaal = models.CharField(max_length=50, null=True, blank=True)
    classification = models.CharField(max_length=50, null=True, blank=True)
    grader = models.CharField(max_length=100, null=True, blank=True)
    deboning_plant = models.CharField(max_length=50, null=True, blank=True)
    processing_plant = models.CharField(max_length=50, null=True, blank=True)
    rendering_plant = models.CharField(max_length=50, null=True, blank=True)
    residue = models.CharField(max_length=50, null=True, blank=True)
    member_2018 = models.CharField(max_length=50, null=True, blank=True)
    member_2019 = models.CharField(max_length=50, null=True, blank=True)
    member_2020 = models.CharField(max_length=50, null=True, blank=True)
    member_2021 = models.CharField(max_length=50, null=True, blank=True)
    member_2022 = models.CharField(max_length=50, null=True, blank=True)
    member_2023 = models.CharField(max_length=50, null=True, blank=True)
    member_2024 = models.CharField(max_length=50, null=True, blank=True)
    member_2025 = models.CharField(max_length=50, null=True, blank=True)
    member_2026 = models.CharField(max_length=50, null=True, blank=True)
    other_comments = models.TextField(null=True, blank=True)
    can_mail = models.CharField(max_length=50, null=True, blank=True)
    date_mail_sent = models.CharField(max_length=100, null=True, blank=True)
    verification = models.CharField(max_length=100, null=True, blank=True)
    db_updated = models.CharField(max_length=100, null=True, blank=True)
    latest_update_received = models.CharField(max_length=255, null=True, blank=True)
    db_comment = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'AbattoirMaster'


class TransformationMaster(AuditFieldsMixin):
    abattoir_name = models.CharField(max_length=255, null=True, blank=True)
    rn_nr = models.CharField(max_length=50, null=True, blank=True)
    ifc = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, null=True, blank=True)
    report_date = models.CharField(max_length=100, null=True, blank=True)
    za_nr = models.CharField(max_length=100, null=True, blank=True)
    expiry_date_za = models.CharField(max_length=100, null=True, blank=True)
    import_col = models.CharField(max_length=255, null=True, blank=True)
    black_owned = models.CharField(max_length=50, null=True, blank=True)
    transformation_abattoirs = models.CharField(max_length=50, null=True, blank=True)
    contributing = models.CharField(max_length=50, null=True, blank=True)
    province = models.CharField(max_length=100, null=True, blank=True)
    seta = models.CharField(max_length=100, null=True, blank=True)
    tel_1 = models.CharField(max_length=100, null=True, blank=True)
    tel_2 = models.CharField(max_length=100, null=True, blank=True)
    fax = models.CharField(max_length=100, null=True, blank=True)
    vat_number = models.CharField(max_length=100, null=True, blank=True)
    postal_address = models.CharField(max_length=500, null=True, blank=True)
    city = models.CharField(max_length=255, null=True, blank=True)
    postal_code = models.CharField(max_length=50, null=True, blank=True)
    municipality = models.CharField(max_length=255, null=True, blank=True)
    physical_address = models.CharField(max_length=500, null=True, blank=True)
    gps_coordinates = models.CharField(max_length=255, null=True, blank=True)
    blank = models.CharField(max_length=255, null=True, blank=True)
    owner = models.CharField(max_length=255, null=True, blank=True)
    owner_email = models.CharField(max_length=255, null=True, blank=True)
    owner_cell = models.CharField(max_length=100, null=True, blank=True)
    manager = models.CharField(max_length=255, null=True, blank=True)
    manager_email = models.CharField(max_length=255, null=True, blank=True)
    manager_cell = models.CharField(max_length=100, null=True, blank=True)
    training = models.CharField(max_length=255, null=True, blank=True)
    training_email = models.CharField(max_length=255, null=True, blank=True)
    training_cell = models.CharField(max_length=100, null=True, blank=True)
    accounts = models.CharField(max_length=255, null=True, blank=True)
    accounts_email = models.CharField(max_length=255, null=True, blank=True)
    accounts_cell = models.CharField(max_length=100, null=True, blank=True)
    emails = models.CharField(max_length=500, null=True, blank=True)
    technical_manager = models.CharField(max_length=255, null=True, blank=True)
    contact_number = models.CharField(max_length=100, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    qc_hygiene_manager = models.CharField(max_length=255, null=True, blank=True)
    qc_hygiene_cell = models.CharField(max_length=100, null=True, blank=True)
    qc_hygiene_email = models.CharField(max_length=255, null=True, blank=True)
    member_2018 = models.CharField(max_length=50, null=True, blank=True)
    member_2019 = models.CharField(max_length=50, null=True, blank=True)
    member_2020 = models.CharField(max_length=50, null=True, blank=True)
    member_2021 = models.CharField(max_length=50, null=True, blank=True)
    member_2022 = models.CharField(max_length=50, null=True, blank=True)
    member_2023 = models.CharField(max_length=50, null=True, blank=True)
    member_2024 = models.CharField(max_length=50, null=True, blank=True)
    member_2025 = models.CharField(max_length=50, null=True, blank=True)
    kosher = models.CharField(max_length=50, null=True, blank=True)
    halaal = models.CharField(max_length=50, null=True, blank=True)
    deboning_plant = models.CharField(max_length=50, null=True, blank=True)
    processing_plant = models.CharField(max_length=50, null=True, blank=True)
    rendering_plant = models.CharField(max_length=50, null=True, blank=True)
    residue = models.CharField(max_length=50, null=True, blank=True)
    lh = models.CharField(max_length=50, null=True, blank=True)
    g = models.CharField(max_length=50, null=True, blank=True)
    units = models.CharField(max_length=50, null=True, blank=True)
    cattle = models.CharField(max_length=50, null=True, blank=True)
    calves = models.CharField(max_length=50, null=True, blank=True)
    sheep = models.CharField(max_length=50, null=True, blank=True)
    pig = models.CharField(max_length=50, null=True, blank=True)
    goat = models.CharField(max_length=50, null=True, blank=True)
    game = models.CharField(max_length=50, null=True, blank=True)
    crocodiles = models.CharField(max_length=50, null=True, blank=True)
    meat_inspection_services = models.CharField(max_length=255, null=True, blank=True)
    blank_1 = models.CharField(max_length=255, null=True, blank=True)
    blank_2 = models.CharField(max_length=255, null=True, blank=True)
    blank_3 = models.CharField(max_length=255, null=True, blank=True)
    db_updated = models.CharField(max_length=100, null=True, blank=True)
    latest_update_received = models.CharField(max_length=255, null=True, blank=True)
    db_comment = models.TextField(null=True, blank=True)
    other_comments = models.TextField(null=True, blank=True)
    returned_email = models.CharField(max_length=255, null=True, blank=True)
    returned_email_comments = models.TextField(null=True, blank=True)
    diaries_2022 = models.CharField(max_length=500, null=True, blank=True)
    calendars_2023 = models.CharField(max_length=500, null=True, blank=True)
    notebooks_2024 = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'TransformationMaster'


class GovernmentMaster(AuditFieldsMixin):
    department = models.CharField(max_length=255, null=True, blank=True)
    detail = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    tel_1 = models.CharField(max_length=100, null=True, blank=True)
    cellphone_number = models.CharField(max_length=100, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    position = models.CharField(max_length=255, null=True, blank=True)
    department_2 = models.CharField(max_length=255, null=True, blank=True)
    directorate = models.CharField(max_length=255, null=True, blank=True)
    sub_directors = models.CharField(max_length=255, null=True, blank=True)
    address = models.CharField(max_length=500, null=True, blank=True)
    blank_1 = models.CharField(max_length=255, null=True, blank=True)
    town = models.CharField(max_length=255, null=True, blank=True)
    blank_2 = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'GovernmentMaster'


class IndustryMaster(AuditFieldsMixin):
    company = models.CharField(max_length=500, null=True, blank=True)
    number = models.CharField(max_length=200, null=True, blank=True)
    number_1 = models.CharField(max_length=200, null=True, blank=True)
    fax = models.CharField(max_length=200, null=True, blank=True)
    vat_number = models.CharField(max_length=200, null=True, blank=True)
    postal_address = models.CharField(max_length=500, null=True, blank=True)
    physical_address = models.CharField(max_length=500, null=True, blank=True)
    contact_1 = models.CharField(max_length=300, null=True, blank=True)
    position_1 = models.CharField(max_length=300, null=True, blank=True)
    email_1 = models.CharField(max_length=300, null=True, blank=True)
    cell_1 = models.CharField(max_length=200, null=True, blank=True)
    contact_2 = models.CharField(max_length=300, null=True, blank=True)
    position_2 = models.CharField(max_length=300, null=True, blank=True)
    email_2 = models.CharField(max_length=300, null=True, blank=True)
    cell_2 = models.CharField(max_length=200, null=True, blank=True)
    contact_3 = models.CharField(max_length=300, null=True, blank=True)
    position_3 = models.CharField(max_length=300, null=True, blank=True)
    email_3 = models.CharField(max_length=300, null=True, blank=True)
    cell_3 = models.CharField(max_length=200, null=True, blank=True)
    contact_4 = models.CharField(max_length=300, null=True, blank=True)
    position_4 = models.CharField(max_length=300, null=True, blank=True)
    email_4 = models.CharField(max_length=300, null=True, blank=True)
    cell_4 = models.CharField(max_length=200, null=True, blank=True)
    diary_2022 = models.CharField(max_length=200, null=True, blank=True)
    calendar_2023 = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        db_table = 'IndustryMaster'


class AssociatedMembersMaster(AuditFieldsMixin):
    company = models.CharField(max_length=500, null=True, blank=True)
    member_2017 = models.CharField(max_length=200, null=True, blank=True)
    member_2018 = models.CharField(max_length=200, null=True, blank=True)
    member_2019 = models.CharField(max_length=200, null=True, blank=True)
    member_2020 = models.CharField(max_length=200, null=True, blank=True)
    member_2021 = models.CharField(max_length=200, null=True, blank=True)
    member_2022 = models.CharField(max_length=200, null=True, blank=True)
    member_2023 = models.CharField(max_length=200, null=True, blank=True)
    member_2024 = models.CharField(max_length=200, null=True, blank=True)
    member_2025 = models.CharField(max_length=200, null=True, blank=True)
    tel_1 = models.CharField(max_length=200, null=True, blank=True)
    tel_2 = models.CharField(max_length=200, null=True, blank=True)
    fax = models.CharField(max_length=200, null=True, blank=True)
    vat_number = models.CharField(max_length=200, null=True, blank=True)
    postal_address = models.CharField(max_length=500, null=True, blank=True)
    physical_address = models.CharField(max_length=500, null=True, blank=True)
    contact_1 = models.CharField(max_length=300, null=True, blank=True)
    position_1 = models.CharField(max_length=300, null=True, blank=True)
    email_1 = models.CharField(max_length=300, null=True, blank=True)
    cell_1 = models.CharField(max_length=200, null=True, blank=True)
    contact_2 = models.CharField(max_length=300, null=True, blank=True)
    position_2 = models.CharField(max_length=300, null=True, blank=True)
    email_2 = models.CharField(max_length=300, null=True, blank=True)
    cell_2 = models.CharField(max_length=200, null=True, blank=True)
    comments = models.TextField(null=True, blank=True)
    changes = models.TextField(null=True, blank=True)
    notebook_2024 = models.CharField(max_length=200, null=True, blank=True)

    class Meta:
        db_table = 'AssociatedMembersMaster'


class _TrainingBase(AuditFieldsMixin):
    province = models.CharField(max_length=255, null=True, blank=True)
    municipality = models.CharField(max_length=255, null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    surname = models.CharField(max_length=255, null=True, blank=True)
    id_number = models.CharField(max_length=255, null=True, blank=True)
    year_of_birth = models.CharField(max_length=50, null=True, blank=True)
    age = models.CharField(max_length=50, null=True, blank=True)
    citizen = models.CharField(max_length=255, null=True, blank=True)
    race_gender = models.CharField(max_length=255, null=True, blank=True)
    training_date = models.CharField(max_length=100, null=True, blank=True)
    abattoir_name = models.CharField(max_length=255, null=True, blank=True)
    thru_put = models.CharField(max_length=100, null=True, blank=True)
    specie = models.CharField(max_length=255, null=True, blank=True)
    work_station = models.CharField(max_length=255, null=True, blank=True)
    report_to_client = models.CharField(max_length=255, null=True, blank=True)
    reported_by = models.CharField(max_length=255, null=True, blank=True)
    sample_take = models.CharField(max_length=255, null=True, blank=True)
    lab_report_received = models.CharField(max_length=255, null=True, blank=True)
    am = models.CharField(max_length=10, null=True, blank=True)
    af = models.CharField(max_length=10, null=True, blank=True)
    ad = models.CharField(max_length=10, null=True, blank=True)
    cm = models.CharField(max_length=10, null=True, blank=True)
    cf = models.CharField(max_length=10, null=True, blank=True)
    cd = models.CharField(max_length=10, null=True, blank=True)
    im = models.CharField(max_length=10, null=True, blank=True)
    if_col = models.CharField(max_length=10, null=True, blank=True, db_column='if_')
    id_2 = models.CharField(max_length=10, null=True, blank=True)
    wm = models.CharField(max_length=10, null=True, blank=True)
    wf = models.CharField(max_length=10, null=True, blank=True)
    wd = models.CharField(max_length=10, null=True, blank=True)
    tot_m = models.CharField(max_length=10, null=True, blank=True)
    tot_f = models.CharField(max_length=10, null=True, blank=True)
    tot_d = models.CharField(max_length=10, null=True, blank=True)
    age_lt35 = models.CharField(max_length=10, null=True, blank=True)
    age_35_55 = models.CharField(max_length=10, null=True, blank=True)
    age_gt55 = models.CharField(max_length=10, null=True, blank=True)
    age_2 = models.CharField(max_length=100, null=True, blank=True)
    total_race_gender = models.CharField(max_length=10, null=True, blank=True)
    total_male_female = models.CharField(max_length=10, null=True, blank=True)
    total_per_age_group = models.CharField(max_length=10, null=True, blank=True)
    disability = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        abstract = True


class STTTrainingReport(_TrainingBase):
    training_start_date = models.CharField(max_length=100, null=True, blank=True)
    training_end_date = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        db_table = 'STTTrainingReport'


class TrainingReport(_TrainingBase):
    class Meta:
        db_table = 'TrainingReport'


class _ResidueBase(AuditFieldsMixin):
    record_id = models.CharField(max_length=64, default='')
    species = models.CharField(max_length=50, null=True, blank=True)
    est_no = models.CharField(max_length=100, null=True, blank=True)
    establishment = models.CharField(max_length=255, null=True, blank=True)
    substance = models.CharField(max_length=100, null=True, blank=True)
    specie = models.CharField(max_length=100, null=True, blank=True)
    sample_type = models.CharField(max_length=100, null=True, blank=True)
    sample_ref = models.CharField(max_length=100, null=True, blank=True)
    job_number = models.CharField(max_length=100, null=True, blank=True)
    sample_id = models.CharField(max_length=100, null=True, blank=True)
    pooled_or_single = models.CharField(max_length=50, null=True, blank=True)
    farm_name = models.CharField(max_length=255, null=True, blank=True)
    district = models.CharField(max_length=255, null=True, blank=True)
    state_vet_area = models.CharField(max_length=255, null=True, blank=True)
    province = models.CharField(max_length=255, null=True, blank=True)
    authorised_person = models.CharField(max_length=255, null=True, blank=True)
    owner = models.CharField(max_length=255, null=True, blank=True)
    authority_sampling = models.CharField(max_length=255, null=True, blank=True)
    date_collected = models.CharField(max_length=50, null=True, blank=True)
    date_signed = models.CharField(max_length=50, null=True, blank=True)
    date_received_lab = models.CharField(max_length=50, null=True, blank=True)
    date_registered = models.CharField(max_length=50, null=True, blank=True)
    date_captured = models.CharField(max_length=50, null=True, blank=True)
    reason_not_analysed = models.CharField(max_length=500, null=True, blank=True)
    date_completed_1 = models.CharField(max_length=50, null=True, blank=True)
    date_completed_2 = models.CharField(max_length=50, null=True, blank=True)
    date_completed_3 = models.CharField(max_length=50, null=True, blank=True)
    date_completed_4 = models.CharField(max_length=50, null=True, blank=True)
    date_completed_5 = models.CharField(max_length=50, null=True, blank=True)
    date_completed_6 = models.CharField(max_length=50, null=True, blank=True)
    date_completed_7 = models.CharField(max_length=50, null=True, blank=True)
    results_1 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_1 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_1 = models.CharField(max_length=200, null=True, blank=True)
    results_2 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_2 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_2 = models.CharField(max_length=200, null=True, blank=True)
    results_3 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_3 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_3 = models.CharField(max_length=200, null=True, blank=True)
    results_4 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_4 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_4 = models.CharField(max_length=200, null=True, blank=True)
    results_5 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_5 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_5 = models.CharField(max_length=200, null=True, blank=True)
    results_6 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_6 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_6 = models.CharField(max_length=200, null=True, blank=True)
    results_7 = models.CharField(max_length=200, null=True, blank=True)
    substance_results_7 = models.CharField(max_length=200, null=True, blank=True)
    ppb_results_7 = models.CharField(max_length=200, null=True, blank=True)
    comments = models.CharField(max_length=1000, null=True, blank=True)
    non_compliant = models.CharField(max_length=100, null=True, blank=True)
    cost_screening = models.CharField(max_length=50, null=True, blank=True)
    cost_confirmation = models.CharField(max_length=50, null=True, blank=True)
    admin_cost = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        abstract = True


class ResidueMonitoringTemp(_ResidueBase):
    batch_id = models.CharField(max_length=50)
    uploaded_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'ResidueMonitoringTemp'


class ResidueMonitoring(_ResidueBase):
    committed_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'ResidueMonitoring'


class AuditLog(models.Model):
    table_name = models.CharField(max_length=100)
    record_id = models.IntegerField()
    action_type = models.CharField(max_length=10, default='EDIT')  # ADD, EDIT, DELETE
    modified_by = models.CharField(max_length=500, null=True, blank=True)
    modified_time = models.CharField(max_length=100, null=True, blank=True)
    modified_fields = models.TextField(null=True, blank=True)
    old_values = models.TextField(null=True, blank=True)
    new_values = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'AuditLog'
        indexes = [models.Index(fields=['table_name', 'record_id'])]


class UserColumnPreferences(models.Model):
    user_id = models.IntegerField()
    page_name = models.CharField(max_length=100)
    hidden_columns = models.TextField(default='[]')
    column_order = models.TextField(default='[]')

    class Meta:
        db_table = 'UserColumnPreferences'
        unique_together = [('user_id', 'page_name')]


class CustomAbattoir(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'CustomAbattoirs'


class Learner(AuditFieldsMixin):
    name = models.CharField(max_length=255, null=True, blank=True)
    surname = models.CharField(max_length=255, null=True, blank=True)
    id_number = models.CharField(max_length=255, null=True, blank=True)
    year_of_birth = models.CharField(max_length=50, null=True, blank=True)
    age = models.CharField(max_length=50, null=True, blank=True)
    citizen = models.CharField(max_length=255, null=True, blank=True)
    race_gender = models.CharField(max_length=255, null=True, blank=True)
    work_stations = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'Learners'


class FeeStructure(AuditFieldsMixin):
    category = models.CharField(max_length=255)
    description = models.TextField()
    days = models.CharField(max_length=100, null=True, blank=True)
    rmaa_members = models.CharField(max_length=100, null=True, blank=True)
    non_members = models.CharField(max_length=100, null=True, blank=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = 'FeeStructure'
        ordering = ['sort_order']


class Facilitator(models.Model):
    name = models.CharField(max_length=255)
    surname = models.CharField(max_length=255, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = 'Facilitators'
