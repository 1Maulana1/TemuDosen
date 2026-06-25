"""
CSRF endpoint smoke tests.
Verifies GET /api/csrf/ sets the csrftoken cookie in the response.
"""
import pytest


@pytest.mark.django_db
class TestCSRFCookieEndpoint:
    def test_get_csrf_returns_200(self, api_client):
        """GET /api/csrf/ returns 200 OK."""
        response = api_client.get('/api/csrf/')
        assert response.status_code == 200

    def test_get_csrf_sets_csrftoken_cookie(self, api_client):
        """GET /api/csrf/ sets the csrftoken cookie in the response."""
        response = api_client.get('/api/csrf/')
        assert 'csrftoken' in response.cookies

    def test_get_csrf_returns_detail_message(self, api_client):
        """GET /api/csrf/ returns a JSON body with 'detail' key."""
        response = api_client.get('/api/csrf/')
        assert response.data.get('detail') == 'CSRF cookie set'
