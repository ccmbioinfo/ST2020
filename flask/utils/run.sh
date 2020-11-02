#!/usr/bin/env bash

set -euo pipefail

PYTHON=${PYTHON:-python3}
COMMAND=${FLASK:-$PYTHON -m flask}
LC_ALL=C.UTF-8
LANG=C.UTF-8
FLASK_APP=app/__init__.py
$COMMAND db upgrade
if [[ "$1" == "prod" ]]; then
    shift
    gunicorn wsgi:app "$@"
elif [[ "$1" == "test" ]]; then
    shift
    $PYTHON -m pytest "$@"
else
    $COMMAND add-default-admin
    $COMMAND add-dummy-data
    export FLASK_ENV=development
    $COMMAND run "$@"
fi
