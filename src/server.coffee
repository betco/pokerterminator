
msgpack = require 'msgpack'
io = require 'engine.ns.io'
net = require 'net'
connect = require 'connect'
yaml = require 'js-yaml'
fs = require 'fs'

# find config
if fs.existsSync process.argv[process.argv.length-1]
    config_path = process.argv[process.argv.length-1]
else if fs.existsSync '/etc/pokerterminator.yaml'
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

# drop privileges (root only)
if process.getuid() == 0
    process.setgid(config.setgid) && console.log 'setgid:', config.setgid if config.setgid
    process.setuid(config.setuid) && console.log 'setuid:', config.setuid if config.setuid

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

    io_socket.on 'error', (err) ->
        console.log 'io_socket.err:', err
        io_socket.close()
        network.destroy()

    io_socket.on 'close', ->
        console.log 'io_socket.close'
        network.destroy()

    network.on 'close', ->
        console.log 'network.close'
        io_socket.close()

    network.on 'error', (err) ->
        console.log 'network.error:', err
        io_socket.send_ns 'err', err
        network.destroy()
        io_socket.close()