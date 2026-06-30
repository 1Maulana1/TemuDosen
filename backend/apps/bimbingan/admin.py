from django.contrib import admin
from .models import Session, DosenCalendarToken, SystemLog

admin.site.register(Session)
admin.site.register(DosenCalendarToken)
admin.site.register(SystemLog)
