"""URL routing for the RMAA Django API.

Path shape matches the existing Node/Express backend exactly so the React
frontend works without changes.
"""
from django.urls import path
from . import views as v


def _master(resource_prefix: str, builder_views: dict):
    """Routes for a master CRUD resource (5x copies: abattoir, transformation, etc.)"""
    return [
        path(f'{resource_prefix}', builder_views['list_create']),
        path(f'{resource_prefix}/count', builder_views['count']),
        path(f'{resource_prefix}/<int:pk>', builder_views['retrieve_update_delete']),
        path(f'{resource_prefix}/<int:pk>/history', builder_views['history']),
    ]


urlpatterns = [
    # status / health
    path('status', v.status_view),
    path('health', v.health_view),

    # auth
    path('login', v.login_view),

    # users + invitations
    path('users', v.users_list_view),
    path('users/invite', v.users_invite_view),
    path('users/invite/accept', v.users_invite_accept_view),
    path('users/invite/<str:token>', v.users_invite_lookup_view),
    path('users/<int:pk>/permissions', v.users_permissions_view),
    path('users/<int:pk>/role', v.users_role_view),
    path('users/<int:pk>', v.users_delete_view),

    # user preferences
    path('user-prefs', v.user_prefs_view),

    # audit log
    path('audit-log', v.audit_log_view),

    # abattoir (extras must come before the <int:pk> route so /names doesn't
    # get matched as a PK)
    path('abattoir/names', v.abattoir_names_view),
    path('abattoir/custom', v.abattoir_custom_add_view),
    path('abattoir/custom/<int:pk>', v.abattoir_custom_delete_view),
    path('abattoir/<int:pk>/send-database-form', v.abattoir_send_form_view),
    *_master('abattoir', v.abattoir_views),

    # transformation
    *_master('transformation', v.transformation_views),

    # government
    *_master('government', v.government_views),

    # industry
    *_master('industry', v.industry_views),

    # associated members
    *_master('associated-members', v.associated_views),

    # training report (non-STT)
    *_master('training-report', v.training_views),

    # STT training report — custom list then rest of CRUD
    path('stt-training-report', v.stt_list_create_view),
    path('stt-training-report/count', v.stt_views['count']),
    path('stt-training-report/breakdown', v.stt_breakdown_view),
    path('stt-training-report/parse-excel', v.stt_parse_excel_view),
    path('stt-training-report/export-pdf', v.stt_export_pdf_view),
    path('stt-training-report/<int:pk>', v.stt_views['retrieve_update_delete']),
    path('stt-training-report/<int:pk>/history', v.stt_views['history']),

    # residue monitoring
    path('residue/template', v.residue_template_view),
    path('residue/upload', v.residue_upload_view),
    path('residue/temp/<str:batch_id>', v.residue_temp_view),
    path('residue/commit-rows', v.residue_commit_view),
    path('residue/committed', v.residue_committed_view),
    path('residue/committed/all', v.residue_clear_all_view),
    path('residue/committed/<int:pk>', v.residue_committed_update_view),

    # quotation
    path('quotation/abattoir-details', v.quotation_abattoir_details_view),
    path('quotation/generate', v.quotation_generate_view),
    path('quotation/send', v.quotation_send_view),

    # documents
    path('documents/tree', v.documents_tree_view),
    path('documents/view', v.documents_view_view),
    path('documents/download', v.documents_download_view),
    path('documents/delete', v.documents_delete_view),
]
