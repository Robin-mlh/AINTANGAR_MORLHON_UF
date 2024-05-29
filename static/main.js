const ADRESS = "http://127.0.0.1:5000"
let selectedUsername
let contacts = []
let messages = {}
let socket_id
let username
let token

function updateDisplayedMessages() {
    // Mettre à jours les messages affichés à l'écran.

    $('.messages').empty()
    $('.messages').append('<div class="anchor"></div>')
    console.log(messages)
    if (messages[selectedUsername] != undefined) {
        messages[selectedUsername].forEach(function(msg) {
            if (msg.toUser == username && msg.fromUser == username) {
                messageClass = "mine"
            } else if (msg.toUser == username) {
                messageClass = "theirs"
            } else {
                messageClass = "mine"
            }
            fileElement = ''
            if (msg.file) {
                blob = new Blob([msg.file], {type: msg.file.type})
                url = URL.createObjectURL(blob)
                fileElement = '<a href="' + url + '" download="' + msg.fileName + '" class="file-link">' + msg.fileName + '</a>'
            }
            closeButton = messageClass === "mine" ? '<button id="deleteSingleChatMessage" class="close-button" data-id="' + msg.id + '">X</button>' : ''
            $('.messages').prepend('<div class="bubble ' + messageClass + '" data-id="' + msg.id + '"><p>' + msg.text + closeButton + '</p> ' + fileElement + '</div>')
        })
    }
}

$(document).ready(function () {
    const socket = io({ autoConnect: false })
    socket.onAny((event, ...args) => {
        console.log(event, args)
    })
    async function waitForToken() {
        // Récupérer le token depuis les cookies.
        return new Promise((resolve) => {
            function checkToken() {
                token = localStorage.getItem('token')
                if (token) {
                    resolve(token)
                } else {
                    setTimeout(checkToken, 100)
                }
            }
            checkToken()
        })
    }
    waitForToken().then((token) => {
        // Lorsque le token est chargé,
        // se connecter au socket SocketIO.
        socket.auth = token
        socket.connect()
    })

    window.onbeforeunload = function () {
        // Eteindre la connexion lorsque la fenetre est fermée.
        socket.emit('client disconnect', {'socket_id': socket_id, "username": username})
    }

    function sendMessage() {
        // Envoyer un message.
        // file et fileName sont null si fichier non chargé.

        file = $('.fileInput')[0].files[0]
        if (file == undefined) {
            file = null
            fileName = null
        } else {
            fileName = file.name
        }

        let text = $('.messageInput').val().trim()
        if (text || file) {
            $('.messageInput').val('')
            $('.fileInput').val('')
            let message = {
                fromUser: username, toUser: selectedUsername,
                text: text, file: file, fileName: fileName}
            socket.emit('private message', message)
            if (selectedUsername != username) {
                if (!messages[selectedUsername]) {
                    messages[selectedUsername] = []
                }
                messages[selectedUsername].push(message)
                updateDisplayedMessages()
            }
        }
    }

    function updateUserList() {
        // Mettre à jour la liste des contacts.
        
        $('.chat-list').empty()
        contacts.forEach(function(user) {
            isMe = ""
            deleteButton = '<button id="deleteUserConversation" class="close-button" data-user="' + user + '">X</button>'
            
            if (user == username) {
                isMe = " (me) "
                deleteButton = "" // Ne pas afficher le bouton "X" si user == username
            }
    
            let lastMessage = {text: ""}
            if (messages[user] && messages[user].length > 0) {
                lastMessage = messages[user][messages[user].length - 1]
            }
    
            contentUserItem = '<img src="/static/image/avatar.jpg" alt="Avatar" class="avatar"> <h4>' + user + isMe + '</h4> <p>' + lastMessage.text + '</p>'
            chatItem = $('<div class="chat-item"></div>')
            chatInfo = $('<div class="call_user chat-info" data-user="' + user + '"></div>').html(contentUserItem)
            chatItem.append(chatInfo)
            chatItem.append(deleteButton)
            if (user == selectedUsername) {
                // Couleur différente pour le contact sélectionné.
                chatItem.addClass('selected-contact')
            }
            $('.chat-list').append(chatItem)
        })
    }
    

    socket.on('private message', function (message) {
        if (!messages[message.fromUser]) {
            messages[message.fromUser] = []
        }
        messages[message.fromUser].push(message)
        updateUserList()
        if (message.fromUser == selectedUsername) {
            updateDisplayedMessages()
        }
    })

    socket.on('new contact', function (data) {
        if (data.username != username && !contacts.includes(data.username)) {
            contacts.push(data.username)
            updateUserList()
        }
    })

    socket.on('del contact', function (data) {
        index_a_del = contacts.indexOf(data.username)
        if (index_a_del !== -1) {
            contacts.splice(index_a_del, 1)
        }
        updateUserList()
    })

    socket.on('connection infos', function (data) {
        username = data.username
        socket_id = data.socket_id
        selectedUsername = data.username
    })

    socket.on('connection contacts', function (data) {
        contacts = data.contacts
        contacts.push(username)
    })

    socket.on('connection messages', function (data) {
        messages = data.messages
        updateUserList()
        updateDisplayedMessages()
    })

    $('.messageForm').submit(function (event) {
        event.preventDefault()
        sendMessage()
    })

    $('.messageInput').keypress(function (event) {
        if (event.which === 13) {
            event.preventDefault()
            sendMessage()
        }
    })

    $(document).on('click', '.addContact', function() {
        if (token) {
            newContact = prompt('Utilisateur à ajouter :')
            if (newContact) {
                socket.emit('new contact', {token: token, new_contact: newContact})
            }
        } else {
            alert("Veuillez vous connecter.")
        }
    })

    $(document).on('click','#deleteUserConversation', function() {
        userToDelete = $(this).data('user')
        if (userToDelete != username) {
            socket.emit('del contact', {username: username, contact: userToDelete})
            index_a_del = contacts.indexOf(userToDelete)
            if (index_a_del > -1) {
                contacts.splice(index_a_del, 1)
            }
            socket.emit('del message', {token: token, id_message: userToDelete})
            selectedUsername = username
            updateUserList()
        }
    })
    
    $(document).on('click','#deleteSingleChatMessage', function() {
        idToDelete = $(this).data('id')
        elementADel = document.querySelector('[data-id="' + idToDelete + '"]')
        if (elementADel) {
            elementADel.remove()
        }
        socket.emit('del message', {token: token, id: idToDelete})

    })

    $(document).on('click', '.call_user', function() {
        // Sélection d'un contact.
    
        selectedUsername = $(this).data('user')
        if (!messages[selectedUsername]) {
            messages[selectedUsername] = []
        }
        updateDisplayedMessages()
        updateUserList()
    })
})

$(document).on('click', '.logout', function() {
    // Supprimer le token des cookies et recharger la page lors de la déconnexion.

    token = ''
    localStorage.removeItem('token')
    location.reload()
})