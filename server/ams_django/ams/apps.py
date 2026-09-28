from django.apps import AppConfig


class AmsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'ams'

    def ready(self):
        from django.conf import settings
        from ams.db import AmsDb
        AmsDb.ensure_backup_folder(str(settings.FRONTEND_ROOT))
