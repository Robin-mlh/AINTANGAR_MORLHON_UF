const ADRESS = "http://127.0.0.1:5000"
let selectedUsername
let users_connected = []
let messages = {}
let socket_id
let username
let token

function updateDisplayedMessages() {
    $('.messages').empty()
    messages[selectedUsername].forEach(function(msg) {
        if (msg.toUser == username) {
            messageClass = "theirs"
        } else {
            messageClass = "mine"
        }
        fileLink = ''
        if (msg.file) {
            fileLink = '<a href="#" class="file-link">' + msg.file.name + '</a>'
        }
        $('.messages').append('<div class="message ' + messageClass + '"><p>' + msg.text + '</p>' + fileLink + '</div>')
    })
}

$(document).ready(function () {
    const socket = io({ autoConnect: false })
    socket.onAny((event, ...args) => {
        console.log(event, args)
    })
    async function waitForToken() {
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
        socket.auth = token
        socket.connect()
    })

    window.onbeforeunload = function () {
        socket.emit('client disconnect', {'socket_id': socket_id,
            "username": username})
    }

    function sendMessage() {
        let file = $('.fileInput')
        if (file.length > 0) {
            file = file[0].files[0]
        } else {
            file = null
        }
        let text = $('.messageInput').val().trim()
        if (file) {
            let reader = new FileReader()
            reader.onload = (e) => {
                file = e.target.result
            }
            reader.readAsDataURL(file)
        }
        if (text || file) {
            $('.messageInput').val('')
            $('.fileInput').val('')
            let message = {
                fromId: socket_id, fromUser: username, toUser: selectedUsername,
                text: text, file: file}
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
        $('.chat-list').empty()
        users_connected.forEach(function(user) {
            if (user == username) {
                isMe = " (me) "
            } else {
                isMe = ""
            }
            let lastMessage = ""
            if (messages[user] && messages[user].length > 0) {
                lastMessage = messages[user][messages[user].length - 1]
            }
            let contentUserItem = '<img src="/static/image/avatar.jpg" alt="Avatar" class="avatar"> <h4>' + user + isMe + '</h4> <p>' + lastMessage.text + '</p>'
            $('.chat-list').append('<div class="chat-item"><div class="call_user chat-info"  data-user="' + user + '">' + contentUserItem + '</div></div>')
        })
    }

    socket.on('private message', function (message) {
        if (!messages[message.fromUser]) {
            messages[message.fromUser] = []
        }
        messages[message.fromUser].push(message)
        if (message.fromUser == selectedUsername) {
            updateDisplayedMessages()
        }
    })

    socket.on('new user', function (data) {
        if (data.username != username) {
            users_connected.push(data.username)
            updateUserList()
        }
    })

    socket.on('del user', function (data) {
        let index_a_del = users_connected.indexOf(data.username)
        if (index_a_del !== -1) {
            users_connected.splice(index_a_del, 1)
        }
        updateUserList()
    })

    socket.on('connection', function (data) {
        username = data.username
        socket_id = data.socket_id
        users_connected = data.users_connected
        selectedUsername = data.username
        updateUserList()
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
})

$(document).on('click', '.call_user', function() {
    selectedUsername = $(this).data('user')
    if (!messages[selectedUsername]) {
        messages[selectedUsername] = []
    }
    updateDisplayedMessages()
})

$(document).on('click', '.logout', function() {
    localStorage.removeItem('token')
    location.reload()
})

$(document).on('click', '.addContact', function() {
    if (token) {
        newContact = prompt('Utilisateur à ajouter :')
        if (newContact) {
            socket.emit('new contact', {username: username, nouveau_contact: newContact})
        }
    } else {
        alert("Veuillez vous connecter.")
    }
})