import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Send, Search, MessageSquare, Plus } from 'lucide-react'
import { io } from 'socket.io-client'

export default function Messages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [contacts, setContacts] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showContacts, setShowContacts] = useState(false)
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)

  useEffect(() => {
    fetchConversations()
    fetchContacts()

    // Initialize Socket.io, authenticated with the same Bearer token as REST:
    // the server joins our own room and stamps our user id on relays.
    // Socket.io endpoint: override with VITE_SOCKET_URL when the backend
    // lives elsewhere (leave unset for local demo on :3000).
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000', {
      auth: { token: localStorage.getItem('token') }
    })
    socketRef.current.emit('join_room')

    socketRef.current.on('receive_message', (data) => {
      if (data.senderId === selectedContact?.id) {
        setMessages(prev => [...prev, data])
      }
      fetchConversations()
    })

    return () => {
      socketRef.current?.disconnect()
    }
  }, [user.id, selectedContact?.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchConversations = async () => {
    try {
      const response = await api.get('/messages/conversations')
      // Normalise : le reste de la page utilise `contact.id`.
      setConversations((response.data || []).map((conv) => ({ ...conv, id: conv.contact_id })))
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async () => {
    try {
      const response = await api.get('/messages/contacts/all')
      setContacts(response.data)
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchMessages = async (contactId) => {
    try {
      const response = await api.get(`/messages/${contactId}`)
      setMessages(response.data)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  const handleSelectContact = (contact) => {
    setSelectedContact(contact)
    setShowContacts(false)
    fetchMessages(contact.id)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedContact) return

    try {
      await api.post('/messages', {
        receiverId: selectedContact.id,
        content: newMessage
      })

      const messageData = {
        senderId: user.id,
        receiverId: selectedContact.id,
        content: newMessage,
        sender_name: `${user.firstName} ${user.lastName}`,
        created_at: new Date().toISOString()
      }

      socketRef.current?.emit('send_message', messageData)
      setMessages(prev => [...prev, messageData])
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const filteredContacts = contacts.filter(contact =>
    (contact.name || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Contacts List */}
      <div className="w-80 card flex flex-col">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <button
              onClick={() => setShowContacts((prev) => !prev)}
              aria-label="Nouvelle conversation"
              title="Nouvelle conversation"
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {showContacts || conversations.length === 0 ? (
            <>
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {conversations.length === 0 ? 'Démarrer une conversation' : 'Nouveau contact'}
              </p>
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => handleSelectContact(contact)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-green-700">
                        {(contact.name || '').split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium text-gray-900 truncate">{contact.name}</p>
                      <p className="text-sm text-gray-500 truncate capitalize">{contact.role}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 px-1 py-2">Aucun contact disponible.</p>
              )}
            </>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.contact_id}
                onClick={() => handleSelectContact(conv)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  selectedContact?.id === conv.contact_id
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary-600">
                    {conv.contact_name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-gray-900 truncate">{conv.contact_name}</p>
                  <p className="text-sm text-gray-500 truncate">{conv.last_message}</p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                    {conv.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 card flex flex-col">
        {selectedContact ? (
          <>
            <div className="pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-600">
                    {selectedContact.contact_name?.split(' ').map(n => n[0]).join('') || selectedContact.name?.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedContact.contact_name || selectedContact.name}
                  </h3>
                  <p className="text-sm text-gray-500 capitalize">
                    {selectedContact.contact_role || selectedContact.role}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                      msg.sender_id === user.id
                        ? 'bg-primary-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-xs mt-1 ${
                      msg.sender_id === user.id ? 'text-primary-100' : 'text-gray-500'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="pt-4 border-t border-gray-200">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="input flex-1"
                />
                <button type="submit" className="btn-primary px-4" aria-label="Envoyer le message">
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Sélectionnez une conversation</h3>
              <p className="text-gray-500">Choisissez un contact pour commencer à discuter</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
