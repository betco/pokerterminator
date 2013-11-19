
msgpack = require 'msgpack'
io = require 'engine.ns.io'
net = require 'net'
connect = require 'connect'

# host public files
httpd = connect()
    .use(connect.compress())
    .use(connect.static('public/', {maxAge: 315360000}))
    .listen(8080)

# the actual feature
io_server = io.attach httpd,
    path: '/ns.io'
    transports: ['polling', 'websocket']

io_server.on 'connection', (io_socket) ->
    network = net.connect 19387, 'localhost'

    unpacker = new msgpack.Stream(network)
    unpacker.addListener 'msg', (m) ->
        [p_type, p_dict] = m
        p_dict['type'] = p_type
        io_socket.send_ns('pkt', [p_dict])

    io_socket.on 'pkt', (packets) ->
        for packet in packets
            p_type = packet['type']
            delete packet['type']
            network.write(msgpack.pack([p_type, packet]))

    io_socket.on 'close', ->
        network.destroy()

    network.on 'close', ->
        io_socket.close()

    network.on 'error', (err) ->
        io_socket.send_ns 'err', err
        network.destroy()
        io_socket.close()