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
        if username_found:
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
        login_query = 'SELECT id, username, password, token FROM users WHERE token = ?'
        user_data = execute_query(login_query, parameters=(auth,), fetchone=True)
        if user_data:
            if not user_data[1] in clients_socket:
                clients_socket[user_data[1]] = {"socket_id_list": []}
            elif not clients_socket[user_data[1]]["socket_id_list"]:
                clients_socket[user_data[1]]["socket_id_list"] = []
            if not user_data[1] in users_connected:
                users_connected.append(user_data[1])
            clients_socket[user_data[1]]["socket_id_list"].append(request.sid)
            socket.emit("connection",
                {"socket_id": request.sid, "username": user_data[1],
                "users_connected": users_connected},
                room=request.sid)
            socket.emit("new user", {"username": user_data[1]})

@socket.on('client disconnect')
def handle_disconnect(data):
    socket.emit("del user", {"username": data["username"]})
    users_connected.remove(data["username"])

@socket.on('private message')
def handle_message(data):
    for socket_id in clients_socket[data["toUser"]]["socket_id_list"]:
        socket.emit('private message', data, room=socket_id)

@socket.on('new contact')
def handle_message(data):
    execute_query("INSERT INTO contacts (user_username, contact_username) VALUES (1, 2)",
        parameters=(data["username"], data["nouveau_contact"]))


if __name__ == '__main__':
    socket.run(app, debug=True)