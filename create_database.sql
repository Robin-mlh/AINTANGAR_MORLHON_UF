-- Création de la table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL
);

-- Création de la table des contacts
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_username TEXT NOT NULL,
    contact_username TEXT NOT NULL,
    FOREIGN KEY (user_username) REFERENCES users (username),
    FOREIGN KEY (contact_username) REFERENCES users (username)
);

-- Création de la table des messages
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_username TEXT NOT NULL,
    recipient_username TEXT NOT NULL,
    content_text TEXT NOT NULL,
    content_file TEXT NOT NULL,
    name_file TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_username) REFERENCES users (username),
    FOREIGN KEY (recipient_username) REFERENCES users (username)
);