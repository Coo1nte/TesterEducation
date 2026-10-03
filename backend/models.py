from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String, index=True, nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    questions = Column(JSON, nullable=False)
    random_count = Column(Integer, default=0)
    share_code = Column(String, unique=True, index=True, nullable=False)
    time_limit = Column(Integer, default=0)
    shuffle_questions = Column(Boolean, default=False)
    folder = Column(String, default="")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    submissions = relationship(
        "Submission",
        back_populates="test",
        cascade="all, delete-orphan",
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True, nullable=False)
    test_id = Column(Integer, ForeignKey("tests.id"), nullable=False)
    name = Column(String, nullable=False)
    score = Column(Integer, default=0)
    total = Column(Integer, default=0)
    answered = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    detailed = Column(JSON, nullable=False)
    at = Column(String, nullable=False)

    test = relationship("Test", back_populates="submissions")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    login = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_verified = Column(Boolean, default=False)  # подтвердил ли почту
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class EmailCode(Base):
    __tablename__ = "email_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    purpose = Column(String, nullable=False)  # register | reset
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

