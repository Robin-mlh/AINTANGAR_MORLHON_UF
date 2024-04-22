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
