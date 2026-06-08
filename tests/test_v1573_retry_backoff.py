"""
v15.7.3 · test del retry/backoff en wincampo_source._get (standalone, sin API real).

Mockea WinCampoAPI.session.get y time.sleep. Verifica:
  - 2 fallos transitorios + 200 al 3er intento -> 3 calls, sin excepción, datos OK
  - fallo transitorio permanente -> levanta tras 1+3 = 4 intentos
  - 4xx (404) -> propaga sin reintentar (1 call)
  - 503 -> reintenta como transitorio

Uso:
    cd C:\\Users\\USER\\Documents\\GitHub\\pegsa-portal
    python -m tests.test_v1573_retry_backoff
"""
import sys
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import requests
import wincampo_source
from wincampo_source import WinCampoAPI


def _make_api():
    """Instancia sin __init__/_login (no toca red)."""
    api = object.__new__(WinCampoAPI)
    api.token = "faketoken"
    api.session = mock.Mock()
    return api


def _resp(status=200, json_data=None, raise_exc=None):
    r = mock.Mock()
    r.status_code = status
    r.json.return_value = json_data if json_data is not None else {"ok": True}
    if raise_exc is not None:
        r.raise_for_status.side_effect = raise_exc
    else:
        r.raise_for_status = mock.Mock()
    return r


def test_success_on_third():
    api = _make_api()
    api.session.get.side_effect = [
        requests.exceptions.ChunkedEncodingError("boom1"),
        requests.exceptions.ConnectionError("boom2"),
        _resp(200, {"data": 1}),
    ]
    with mock.patch.object(wincampo_source.time, "sleep"):
        out = api._get("lst_test")
    assert out == {"data": 1}, out
    assert api.session.get.call_count == 3, api.session.get.call_count
    print("OK success_on_third: 3 calls, sin excepción, datos correctos")


def test_exhausted_raises():
    api = _make_api()
    api.session.get.side_effect = requests.exceptions.Timeout("always")
    with mock.patch.object(wincampo_source.time, "sleep"):
        raised = False
        try:
            api._get("lst_test")
        except requests.exceptions.Timeout:
            raised = True
    assert raised, "debió propagar Timeout tras agotar reintentos"
    assert api.session.get.call_count == 4, api.session.get.call_count  # 1 + 3 retries
    print("OK exhausted_raises: Timeout propaga tras 4 intentos (1+3)")


def test_4xx_no_retry():
    api = _make_api()
    r404 = _resp(404, raise_exc=requests.exceptions.HTTPError("404", response=None))
    # response.status_code = 404 para que el guard 4xx lo detecte
    err = requests.exceptions.HTTPError("404")
    err.response = mock.Mock(status_code=404)
    r404.raise_for_status.side_effect = err
    api.session.get.side_effect = [r404]
    with mock.patch.object(wincampo_source.time, "sleep"):
        raised = False
        try:
            api._get("lst_test")
        except requests.exceptions.HTTPError:
            raised = True
    assert raised, "404 debió propagar"
    assert api.session.get.call_count == 1, api.session.get.call_count
    print("OK 4xx_no_retry: 404 propaga sin reintentar (1 call)")


def test_503_retries():
    api = _make_api()
    api.session.get.side_effect = [_resp(503), _resp(200, {"data": 2})]
    with mock.patch.object(wincampo_source.time, "sleep"):
        out = api._get("lst_test")
    assert out == {"data": 2}, out
    assert api.session.get.call_count == 2, api.session.get.call_count
    print("OK 503_retries: 503 reintenta y luego 200 (2 calls)")


def main():
    test_success_on_third()
    test_exhausted_raises()
    test_4xx_no_retry()
    test_503_retries()
    print("\nv15.7.3 OK: retry/backoff cubre transitorios, propaga errores reales")


if __name__ == "__main__":
    main()
