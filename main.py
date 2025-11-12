from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from authlib.integrations.flask_client import OAuth
import pandas as pd
from langchain_openai.embeddings import OpenAIEmbeddings
from dotenv import load_dotenv
import jwt, os, json
from datetime import datetime, timedelta, timezone
from user import db
from views import create_user, get_user_by_google_id
from langchain_chroma import Chroma
from flask import Flask, request, Response, stream_with_context, redirect, jsonify, make_response, session
from flask_cors import CORS
from template import template
from openai import OpenAI
from secrets import token_urlsafe
from sqlalchemy import text, inspect

app = Flask(__name__)
CORS(app,supports_credentials=True,origins=["http://localhost:5174"])

load_dotenv()

app.config['SQLALCHEMY_DATABASE_URI'] = "postgresql://postgres:12345@localhost:5173/fake-or-real"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    inspector = inspect(db.engine)
    db.create_all()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
app.secret_key = os.getenv("SECRET_KEY")
secret_key = os.getenv("SECRET_KEY")

web_url = "http://localhost:5174"

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    api_key=os.getenv("OPENAI_API_KEY")
)

oauth = OAuth(app)
google = oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

@app.route("/api/add-chat", methods=["POST"])
def add_chat():
    data = request.get_json()
    
    user = data.get("email", "")
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    question = data.get("question", "")
    
    replies = data.get("replies", [])
    
    if not user:
        return jsonify({"error": "User not logged in."}), 400
    
    with db.engine.begin() as conn:
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS "{user_table_name}" (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                chat_name TEXT NOT NULL,
                replies JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
    response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a Project Manager who organizes chats based on their theme"},
                {"role": "user", "content": f"Write a title for a chat room by finding the theme based on this given question: Are the news about USA nuking North Korea fake?"},
                {"role": "assistant", "content": "Will USA nuke North Korea?"},
                {"role": "user", "content": f"Write a title for a chat room by finding the theme based on this given question: Will China actually invade Taiwan?"},
                {"role": "assistant", "content": "About China invading Taiwan"},
                {"role": "user", "content": f"Write a title for a chat room by finding the theme based on this given question: Is Bulgaria really going to have EURO as its primary currency?"},
                {"role": "assistant", "content": "Bulgaria moving to EURO"},
                {"role": "user", "content": f"Write a title for a chat room by finding the theme based on this given question: {question}"},
            ],
            temperature=0.3,
            max_tokens=500,
        )
    
    chat_name = response.choices[0].message.content
        
    db.session.execute(text(f'INSERT INTO "{user_table_name}" (chat_name, replies) VALUES (:chat_name, :replies)'), {"chat_name": chat_name, "replies": json.dumps(replies)})
    db.session.commit()
    
    return jsonify({"chat_name": chat_name}), 200

@app.route("/api/update-chat", methods=["POST"])
def update_chat():
    data = request.get_json()
    
    user = data.get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"})
    
    chat_id= data.get("chat_id", "")
    replies = data.get("replies", [])
    
    if not chat_id:
        return jsonify({"error": "Chat name didn't pass through."})
    
    db.session.execute(text(f'UPDATE "{user_table_name}" SET replies = :replies WHERE id = :chat_name'), {"replies": json.dumps(replies), "chat_name": chat_id})
    db.session.commit()
    
    return jsonify({"message": "Added replies successfully"}), 200

@app.route("/api/get-chats", methods=["POST"])
def get_chats():
    user = request.get_json().get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"}), 400
    
    if user_table_name in inspector.get_table_names():
        result = db.session.execute(text(f'SELECT id, chat_name FROM "{user_table_name}"'))

        rows = result.fetchall()
        
        chats = [{"id": row.id, "chat_name": row.chat_name} for row in rows]

        return jsonify({"chats": chats}), 200
    
    return jsonify({"chats": []}), 200
 
@app.route("/api/get-chats-search", methods=["POST"])
def get_chats_search():
    data = request.get_json()
    
    user = data.get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    search = data.get("search", "")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"}), 400
    
    if user_table_name in inspector.get_table_names():
        result = db.session.execute(text(f'SELECT id, chat_name FROM "{user_table_name}" WHERE chat_name ILIKE :search'), {"search": f"%{search}%"})
        
        rows = result.fetchall()
        
        chats = [{"id": row.id, "chat_name": row.chat_name} for row in rows]
        
        return jsonify({"chats": chats}), 200
    
    return jsonify({"chats": []}), 200
    
@app.route("/api/get-chats-last-7-days", methods=["POST"])
def get_chats_last_7_days():
    data = request.get_json()
    
    user = data.get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"}), 400
    
    if user_table_name in inspector.get_table_names():
        result = db.session.execute(
            text(f"SELECT id, chat_name FROM \"{user_table_name}\" WHERE created_at >= NOW() - INTERVAL '7 days' AND created_at < CURRENT_DATE")
        )
        
        rows = result.fetchall()
        
        chats = [{"id": row.id, "chat_name": row.chat_name} for row in rows]
        
        return jsonify({"chats": chats}), 200
    
    return jsonify({"chats": []}), 200

@app.route("/api/get-chats-today", methods=["POST"])
def get_chats_today():
    data = request.get_json()
    
    user = data.get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"}), 400
    
    if user_table_name in inspector.get_table_names():
        result = db.session.execute(
            text(f"SELECT id, chat_name FROM \"{user_table_name}\" WHERE created_at::date = CURRENT_DATE")
        )
        
        rows = result.fetchall()
        
        chats = [{"id": row.id, "chat_name": row.chat_name} for row in rows]
        
        return jsonify({"chats": chats}), 200
    
    return jsonify({"chats": []}), 200

@app.route("/api/get-replies", methods=["POST"])
def get_replies():
    data = request.get_json()
    user = data.get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"}), 400
    
    chat_id = data.get("chat_id", -1)
    
    if not chat_id:
        return jsonify({"error": "Chat name not specified"}), 400
    
    if user_table_name in inspector.get_table_names():
        result = db.session.execute(text(f'SELECT replies from "{user_table_name}" WHERE id = :chat_id'), {"chat_id": int(chat_id)})
            
        row = result.fetchone()
        
        replies = row.replies if row else []
        
        return jsonify({"replies": replies}), 200

    return jsonify({"replies": ""}), 200

@app.route("/api/delete-chat", methods=["POST"])
def delete_chat():
    data = request.get_json()
    
    user = data.get("email", "")
    
    user_table_name = "".join(c for c in user if c.isalnum() or c == "@").replace("@", "_")
    
    if not user_table_name:
        return jsonify({"error": "User not specified"}), 400
    
    chat_name = f"{data.get("chat_name", "")}"
    
    if not chat_name:
        return jsonify({"error": "Chat name not specified"}), 400
    
    id_chat = int(data.get("id", ""))
    
    if not id_chat:
        return jsonify({"error": "No id specified."}), 400
    
    if user_table_name in inspector.get_table_names():
        result = db.session.execute(text(f'DELETE FROM "{user_table_name}" WHERE id = :id AND chat_name = :chat_name'), {"id": id_chat, "chat_name": chat_name})
        
        db.session.commit()
        
        if result.rowcount > 0:
            new_result = db.session.execute(text(f'SELECT id, chat_name FROM "{user_table_name}"'))

            rows = new_result.fetchall()
            
            chats = [{"id": row.id, "chat_name": row.chat_name} for row in rows]
            
            return jsonify({"message": f"Successfully deleted row {result}"}, {"chats": chats}), 200
        else:
            return jsonify({"error": "Failed to delete row"}), 400
        
    return jsonify({"message": "No delete happened."}), 400

@app.route("/login")
def login():
    nonce = token_urlsafe(16)
    session['nonce'] = nonce
    redirect_uri = "http://localhost:5000/authorize"
    return google.authorize_redirect(redirect_uri, nonce=nonce)

@app.route("/sign-in")
def sign_in():
    nonce = token_urlsafe(16)
    session['nonce'] = nonce
    session['create_account'] = True
    
    redirect_uri = "http://localhost:5000/authorize"
    return google.authorize_redirect(redirect_uri, nonce=nonce)

@app.route("/authorize")
def authorize():
    create_account = session.pop('create_account', False)
    nonce = session.pop("nonce", None)
    
    try:
        token = google.authorize_access_token()
        id_info = google.parse_id_token(token, nonce=nonce)
        if not token:
            return jsonify({"error": "Authorization failed: no token"}), 401
    except Exception as e:
        print("Authorization error:", e)
        return jsonify({"error": "User not authorized"}), 401

    google_id = id_info["sub"]
    
    user = get_user_by_google_id(google_id)
    
    if not user:
        if create_account:
            user = create_user(google_id, id_info["email"], id_info["name"])
        else:
            return redirect(f"{web_url}/sign-in")

    access_payload = {
        "sub": id_info["sub"],
        "name": id_info.get("name", ""),
        "email": id_info["email"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    
    access_token = jwt.encode(access_payload, secret_key, algorithm="HS256")
    
    refresh_payload = {
        "sub": id_info["sub"],
        "name": id_info.get("name", ""),
        "email": id_info["email"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    
    refresh_token = jwt.encode(refresh_payload, secret_key, algorithm="HS256")

    response = make_response(redirect(web_url))
    
    response.set_cookie(
        "access_token",
        access_token,
        httponly=True,    
        secure=False,
        samesite="Lax",
        max_age=3600
    )
    
    response.set_cookie(
        "refresh_token",
        refresh_token,
        httponly=True,
        secure=False,
        samesite="Lax",
        max_age=7*24*3600
    )

    return response

@app.route("/refresh")
def refresh():
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        return jsonify({"error": "No refresh token"}), 401

    try:
        decoded = jwt.decode(refresh_token, secret_key, algorithms=["HS256"])
        if decoded.get("type") != "refresh":
            return jsonify({"error": "Invalid token type"}), 401

        new_access_payload = {
            "sub": decoded["sub"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        new_access_token = jwt.encode(new_access_payload, secret_key, algorithm="HS256")

        return jsonify({"access_token": new_access_token})
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Refresh token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid refresh token"}), 401

@app.route("/verify")
def verify():
    token = request.cookies.get("access_token")
    try:
        decoded = jwt.decode(token, secret_key, algorithms=["HS256"])
        return jsonify(decoded)
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

@app.route("/logout", methods=["POST"])
def logout():
    response = make_response(jsonify({"message": "Logged out"}))

    response.set_cookie("access_token", "", expires=0, httponly=True, secure=False, samesite="Lax")
    
    response.set_cookie("refresh_token", "", expires=0, httponly=True, secure=False, samesite="Lax")
    
    return response

if os.path.exists("./ai-fake-news-vector-db"):
    vectorstore = Chroma(
        persist_directory="./ai-fake-news-vector-db",
        embedding_function=embeddings
    )
else:
    df = pd.read_csv("fake_news_data.csv")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
        length_function=len
    )

    docs = []
    for _, row in df.iterrows():
        chunks = splitter.split_text(row["text"])
        for chunk in chunks:
            docs.append(
                Document(
                    page_content=chunk,
                    metadata={
                        "title": row["title"],
                        "date": row["date"],
                        "fake_or_factual": row["fake_or_factual"]
                    }
                )
            )

    vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory="./ai-fake-news-vector-db"
    )
    
@app.route("/api/ask", methods=["POST"])
def ask_gpt():
    data = request.get_json()
    question = data.get("question", "")

    retriever = vectorstore.as_retriever(search_type="mmr", search_kwargs={"k": 3, "lambda_mult": 0.7})
    retrieved_docs = retriever.invoke(question)
    context = "\n\n".join([
        f"Title: {d.metadata.get('title', 'Unknown')}\n"
        f"Date: {d.metadata.get('date', 'Unknown')}\n"
        f"Label: {d.metadata.get('fake_or_factual', 'Unknown')}\n"
        f"Content: {d.page_content}"
        for d in retrieved_docs
    ])

    prompt_template = template.format(context=context, question=question)

    def generate():
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Answer based on the provided context."},
                {"role": "user", "content": prompt_template}
            ],
            temperature=0.3,
            max_tokens=500,
            stream=True
        )
        
        for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    return Response(stream_with_context(generate()), mimetype="text/plain")

if __name__ == "__main__":
    app.run(debug=False, use_reloader=False)