
# test connection to pokernetwork through terminator

io = require 'engine.ns.io-client'
program = require 'commander'

list = (str) ->
    return str.split(',')

program
    .option('-p, --port <port>', 'websocket port to connect to, default: 80', parseInt)
    .option('--path <path>', 'engine.io path, default: /ns.io')
    .option('-t, --transports <list>', 'engine.io tansports, default: polling,weboscket', list)
    .parse(process.argv)

s = io.Socket 'ws://localhost:' + (program.port || 80).toString() + '/',
    path: program.path || '/ns.io'
    transports: program.transports || ['polling', 'websocket']

s.on 'open', () ->
    s.send_ns 'pkt', [{type: 'PacketPokerStatsQuery', string: ''}]

s.on 'pkt', (packets) ->
    for packet in packets
        if packet.type == 'PacketPokerStats'
            console.log 'passed!'
            process.exit 0

setTimeout ->
    console.log 'failed!'
    process.exit 1
, 1000

