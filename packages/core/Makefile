
FLOW=$(patsubst src/%.js,lib/%.js.flow,$(wildcard src/**/*.js src/*.js))

lib/%.js.flow: src/%.js
	cp $< $@

dirs:
	mkdir -p lib lib/blob lib/delta lib/multi

build: dirs $(FLOW)
	yarn babel src/*.js -d lib
	yarn babel src/blob/*.js -d lib/blob
	yarn babel src/delta/*.js -d lib/delta
	yarn babel src/multi/*.js -d lib/multi

.PHONY: build