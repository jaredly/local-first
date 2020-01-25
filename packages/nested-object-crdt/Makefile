
FLOW=$(patsubst %.js,lib/%.js.flow,$(wildcard *.js))

lib/%.js.flow: %.js
	cp $< $@

build: $(FLOW)
	yarn babel *.js -d lib
