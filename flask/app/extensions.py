from flask_login import LoginManager
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
login = LoginManager()
migrate = Migrate()

login.session_protection = "strong"