"""Seed the three baseline users — mirrors server/db.js seed block."""
from django.core.management.base import BaseCommand
from api.models import User


SEEDS = [
    {
        'username': 'Anthony',
        'password': 'Admin',
        'role': 'admin',
        'display_name': 'Anthony Penzes',
        'email': 'Anthony.Penzes@moc-pty.com',
    },
    {
        'username': 'admin',
        'password': 'admin123',
        'role': 'admin',
        'display_name': 'Admin User',
        'email': 'admin@rmaa.co.za',
    },
    {
        'username': 'user',
        'password': 'user123',
        'role': 'user',
        'display_name': 'Standard User',
        'email': 'user@rmaa.co.za',
    },
]


class Command(BaseCommand):
    help = 'Seed baseline RMAA users (Anthony, admin, user).'

    def handle(self, *args, **options):
        for seed in SEEDS:
            user, created = User.objects.update_or_create(
                username=seed['username'],
                defaults={
                    'password': seed['password'],
                    'role': seed['role'],
                    'display_name': seed['display_name'],
                    'email': seed['email'],
                },
            )
            self.stdout.write(
                f"{'Created' if created else 'Updated'} user: {user.username} ({user.email})"
            )
