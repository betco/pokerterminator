Poker Terminator
================

Poker Terminator is a software which sits in between a Poker Network server and the browser and translates Packets in JSON format to msgpack format and vice versa.

It listens on a given port for engine.io websocket connections. Whenever a connection is made it also connects to the Poker Network and forwards all packets to and from it.

When either of these connections are closed it closes the other connection too.

Config
------
```yaml
# when you start the terminator as root you can drop privileges
setuid:
    uid: hannes
    gid: hannes

# http config
http:
    port: 60000                         # port to listen on
    static: public/                     # static files to serve

# engine.io config
# find more details on https://github.com/LearnBoost/engine.io-client
eio:
    path: /ns.io                        # http path eingine.io will hook into
    transports: [polling, websocket]    # transports to use

# poker network server
network:
    address: localhost
    port: 19387
```