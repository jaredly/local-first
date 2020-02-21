
FLOW=$(patsubst src/%.js,lib/%.js.flow,$(wildcard src/*.js))

lib/%.js.flow: src/%.js
	cp $< $@

build: $(FLOW)
	yarn babel src/*.js -d lib
