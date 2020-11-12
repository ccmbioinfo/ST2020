#!/usr/bin/env python3

from app import create_app, config

app = create_app(config.Config)

if __name__ == "__main__":
    raise ValueError(config.Config.SQLALCHEMY_DATABASE_URI)
    app.run()
