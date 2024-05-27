from threading import Lock
import uuid
import sqlite3

import trio
import eventlet
eventlet.monkey_patch()
from flask import Flask, render_template, session, copy_current_request_context, request, redirect, url_for, jsonify
from flask_socketio import SocketIO, emit, disconnect
from flask_bcrypt import Bcrypt

async_mode = None
app = Flask(__name__)
bcrypt = Bcrypt(app)
app.config['SECRET_KEY'] = '5EkFYKJVz7x&cUB^97Z9d6iH'
socket = SocketIO(app, async_mode=async_mode, max_http_buffer_size=1e8)
thread = None
thread_lock = Lock()
clients_socket = {}
users_connected = []


def execute_query(query, parameters=None, fetchone=False):
    """ Connects to the SQLite database, executes the query, and closes the connection.

    Parameters:
    - query (str): SQL query to be executed.
    - parameters (tuple): Parameters to be used in the query (default is None).
    - fetchone (bool): If True, fetches only one result (default is False).

    Returns:
    - Result of the query execution.
    """

    conn = sqlite3.connect('db.db')
    cursor = conn.cursor()
    if parameters:
        cursor.execute(query, parameters)
    else:
        cursor.execute(query)
    if fetchone:
        result = cursor.fetchone()
    else:
        result = cursor.fetchall()
    conn.commit()
    conn.close()

    return result


@app.route('/')
def index():
    return render_template('index.html', async_mode=socket.async_mode)

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        data_json = request.get_json()
        username = data_json['username']
        username_found = execute_query('SELECT COUNT(*) FROM users WHERE username = ?', (username,), fetchone=True)
        if username_found == (0,):
            password = data_json['password']
            password = bcrypt.generate_password_hash(password).decode()
            token = str(uuid.uuid4())
            signup_query = 'INSERT INTO users (username, password, token) VALUES (?, ?, ?)'
            signup_parameters = (username, password, token)
            execute_query(signup_query, parameters=signup_parameters)
            return jsonify({"token": token})
        else:
            return jsonify({"token": None})
    return render_template('signup.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data_json = request.get_json()
        username = data_json['username']
        password = data_json['password']
        login_query = 'SELECT id, username, password, token FROM users WHERE username = ?'
        user_data = execute_query(login_query, parameters=(username,), fetchone=True)
        if user_data:
            if bcrypt.check_password_hash(user_data[2], password):
                return jsonify({"token": user_data[3]})
            else:
                return jsonify({"token": None})
        else:
            return jsonify({"token": None})
    return render_template('login.html')

@socket.on('connect')
def handle_connect(auth):
    if auth:
        # Récupération des informations utilisateur grace au token recu dans auth.
        login_query = 'SELECT id, username, password, token FROM users WHERE token = ?'
        user_data = execute_query(login_query, parameters=(auth,), fetchone=True)
        if user_data:
            if not user_data[1] in clients_socket:
                clients_socket[user_data[1]] = {"socket_id_list": []}
            elif not clients_socket[user_data[1]]["socket_id_list"]:
                clients_socket[user_data[1]]["socket_id_list"] = []
            if not user_data[1] in users_connected:
                users_connected.append(user_data[1])
            
            # Ajout de l'utilisateur à la liste des clients connectés.
            clients_socket[user_data[1]]["socket_id_list"].append(request.sid)

            # Envoi des informations de l'utilisateur au client.
            socket.emit("connection infos", {"socket_id": request.sid, "username": user_data[1]}, room=request.sid)

            # Envoi des contacts de l'utilisateur au client.
            contacts_query = '''SELECT contact_username FROM contacts WHERE user_username = ?'''
            contacts = execute_query(contacts_query, parameters=(user_data[1],))
            print(contacts)
            socket.emit("connection contacts", {"contacts": contacts}, room=request.sid)
            
            # Envoyer les messages de l'utilisateur.
            messages_query = '''SELECT sender_username, recipient_username, content_text, content_file, name_file,
                timestamp FROM messages WHERE sender_username = ? OR recipient_username = ?'''
            messages = execute_query(messages_query, parameters=(user_data[1], user_data[1]))
            messages_dict = {}
            user_chat = ""
            for message in messages:
                message_dict = {
                    'fromUser': message[0],
                    'toUser': message[1],
                    'text': message[2],
                    'file': message[3],
                    'fileName': message[4]
                }
                if message[0] == message[1]:
                    user_chat = message[0]
                elif message[0] != user_data[1]:
                    user_chat = message[0]
                elif message[1] != user_data[1]:
                    user_chat = message[1]
                if user_chat in messages_dict:
                    messages_dict[user_chat].append(message_dict)
                else:
                    messages_dict[user_chat] = [message_dict]
            socket.emit("connection messages",
                {"messages": messages_dict},
                room=request.sid)

            # Informer tous les utilisateurs de la connexion.
            socket.emit("new user", {"username": user_data[1]})

@socket.on('client disconnect')
def handle_disconnect(data):
    socket.emit("del user", {"username": data["username"]})
    if data["username"] in users_connected:
        users_connected.remove(data["username"])

@socket.on('private message')
def handle_message(data):
    print(data)
    if data["toUser"] in clients_socket:
        for socket_id in clients_socket[data["toUser"]]["socket_id_list"]:
            socket.emit('private message', data, room=socket_id)
    execute_query("""INSERT INTO messages (sender_username, recipient_username,
                    content_text, content_file, name_file) VALUES (?, ?, ?, ?, ?)""",
    parameters=(data["fromUser"], data["toUser"], data["text"], data["file"], data["fileName"]))

@socket.on('new contact')
def handle_message(data):
    # Obtention de l'username du client avec son token.
    username_query = 'SELECT username FROM users WHERE token = ?'
    username = execute_query(username_query, parameters=(data["token"],), fetchone=True)

    # Vérifier que l'username à ajouter en contact existe.
    username_exist_query = 'SELECT username FROM users WHERE username = ?'
    username_exist = execute_query(username_exist_query, parameters=(data["new_contact"],), fetchone=True)

    # Vérifier que le contact n'est pas deja ajouté par l'utilisateur.
    contact_exist_query = 'SELECT 1 FROM contacts WHERE user_username = ? AND contact_username = ?'
    contact_exist = execute_query(contact_exist_query, parameters=(username[0], data["new_contact"],), fetchone=True)

    if username_exist is not None and contact_exist is None:
        # Ajouter une entrée dans la base de donnée avec le username du client associé au contact.
        execute_query("INSERT INTO contacts (user_username, contact_username) VALUES (?, ?)",
            parameters=(username[0], data["new_contact"]))
        execute_query("INSERT INTO contacts (user_username, contact_username) VALUES (?, ?)",
            parameters=(data["new_contact"], username[0]))

    test_query = 'SELECT * FROM contacts'
    print(execute_query(test_query))


if __name__ == '__main__':
    socket.run(app, debug=True)