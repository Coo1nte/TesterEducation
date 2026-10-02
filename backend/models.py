from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean, text as sa_text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Test(Base):
    __tablename__ = "tests"

    id = Column(Integer, primary_key=True, index=True)
    owner = Column(String, index=True)
    title = Column(String)
    type = Column(String)
    questions = Column(JSON)
    random_count = Column(Integer, default=0)
    share_code = Column(String, unique=True, index=True)
    time_limit = Column(Integer, default=0)
    shuffle_questions = Column(Boolean, default=False)
    folder = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    submissions = relationship(
        "Submission",
        back_populates="test",
        cascade="all, delete-orphan",
    )


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id"))
    name = Column(String)
    score = Column(Integer, default=0)
    total = Column(Integer, default=0)
    answered = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    detailed = Column(JSON)
    at = Column(String)

    test = relationship("Test", back_populates="submissions")



class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    login = Column(String, unique=True, index=True)
    password_hash = Column(String)
    is_verified = Column(Boolean, default=False)  # подтвердил ли почту
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailCode(Base):
    __tablename__ = "email_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    code = Column(String)
    purpose = Column(String)  # register | reset
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

