from user import db, User

def create_user(google_id, email, name):
    user = User(google_id=google_id, email=email, name=name)
    db.session.add(user)
    db.session.commit()
    return user

def get_user_by_google_id(google_id):
    return User.query.filter_by(google_id=google_id).first()