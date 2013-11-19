
msgpack = require 'msgpack'
io = require 'engine.ns.io'
net = require 'net'
connect = require 'connect'
yaml = require 'js-yaml'
fs = require 'fs'

# find config
if fs.existsSync '/etc/pokerterminator.yaml'
    config_path = '/etc/pokerterminator.yaml'
else if fs.existsSync 'pokerterminator.yaml'
    config_path = 'pokerterminator.yaml'
else
    console.log 'config not found!'
    process.exit 1

# load it
console.log 'loading config:', config_path
config = yaml.load fs.readFileSync(config_path).toString()

# host public files
httpd = connect()
    .use(connect.compress())
    .use(connect.static(config.http.static, {maxAge: 315360000}))
    .listen(config.http.port)

# the actual feature
io_server = io.attach httpd,
    path: config.eio.path
    transports: config.eio.transports

io_server.on 'connection', (io_socket) ->
    network = net.connect config.network

    unpacker = new msgpack.Stream network
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