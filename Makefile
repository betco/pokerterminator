export PATH := $(shell pwd)/node_modules/.bin:$(PATH)

DIRS = node_modules/engine.ns.io-client/

all: npm_install public/engine.ns.io-client.js

npm_install:
	npm install

node_modules/engine.ns.io-client/build/engine.ns.io-client.js:
	make -BC node_modules/engine.ns.io-client build

public/engine.ns.io-client.js: node_modules/engine.ns.io-client/build/engine.ns.io-client.js
	cp node_modules/engine.ns.io-client/build/engine.ns.io-client.js public

clean:
	rm -rf node_modules
	rm -rf public/engine.ns.io-client.js

install:
	install -d $(DESTDIR)/usr/lib/poker-terminator/public/ -d $(DESTDIR)/usr/share/poker-terminator/
	cp -r node_modules $(DESTDIR)/usr/lib/poker-terminator/
	install -m 644 src/server.coffee $(DESTDIR)/usr/lib/poker-terminator/
	install -m 644 config.yaml.example $(DESTDIR)/usr/share/poker-terminator/
	install -m 755 src/start_server src/stop_server $(DESTDIR)/usr/lib/poker-terminator/
	install -m 644 public/* $(DESTDIR)/usr/lib/poker-terminator/public/

.PHONY: node_modules/engine.ns.io-client/build/engine.ns.io-client.js
