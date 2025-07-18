
NAME    := dropbeat
UUID  := $(shell awk -F'"' '/uuid/ { print $$4 }' ./static/metadata.json)
VERSION := $(shell awk -F'"' '/version-name/ { print $$4 }' ./static/metadata.json)

STATIC       := ./static
SCHEMAS      := ./schemas
SRC          := ./src
DIST         := ./dist
BUILD        := $(DIST)/build
SCHEMAOUTDIR := $(BUILD)/schemas
PO			 := ./po
RESOURCES    := ./resources

STATICSRCS     := $(wildcard $(STATIC)/*)
SCHEMASRC      := $(SCHEMAS)/org.gnome.shell.extensions.$(NAME).gschema.xml
# This excludes .d.ts files
SRCS           := $(shell find $(SRC) -type f -name '*.ts' ! -name '*.d.ts')
POFILES	       := $(wildcard $(PO)/*.po)

SCHEMAOUT    := $(SCHEMAOUTDIR)/gschemas.compiled
SCHEMACP     := $(SCHEMAOUTDIR)/org.gnome.shell.extensions.$(NAME).gschema.xml
STATICOUT    := $(STATICSRCS:$(STATIC)/%=$(BUILD)/%)
ZIP		     := $(DIST)/$(NAME)-v$(VERSION).zip
POT			 := $(PO)/$(UUID).pot
MOS          := $(POFILES:$(PO)/%.po=$(BUILD)/locale/%/LC_MESSAGES/$(UUID).mo)

# Packages should use make DESTDIR=... for packaging
ifeq ($(strip $(DESTDIR)),)
	INSTALLTYPE = local
	INSTALLBASE = $(HOME)/.local/share/gnome-shell/extensions
else
	INSTALLTYPE = system
	SHARE_PREFIX = $(DESTDIR)/usr/share
	INSTALLBASE = $(SHARE_PREFIX)/gnome-shell/extensions
endif

.PHONY: out pack install clean ts

out: $(POT) ts $(SCHEMAOUT) $(SCHEMACP) $(STATICOUT) $(MOS)

pack: $(ZIP)

pot: $(POT)

install: out
	rm -rf ~/.local/share/gnome-shell/extensions/$(UUID)
	mkdir -p ~/.local/share/gnome-shell/extensions
	cp -r $(BUILD) ~/.local/share/gnome-shell/extensions/$(UUID)
ifeq ($(INSTALLTYPE),system)
	rm -r $(addprefix $(INSTALLBASE)/$(UUID)/, schemas locale LICENSE)
	mkdir -p $(SHARE_PREFIX)/glib-2.0/schemas \
		$(SHARE_PREFIX)/locale \
		$(SHARE_PREFIX)/licenses/$(UUID)
	cp -r $(BUILD)/schemas/*gschema.xml $(SHARE_PREFIX)/glib-2.0/schemas
	cp -r $(BUILD)/locale/* $(SHARE_PREFIX)/locale
	cp -r $(BUILD)/LICENSE $(SHARE_PREFIX)/licenses/$(UUID)
endif

clean:
	rm -rf $(DIST)
	rm -f $(POT)

./node_modules/.package-lock.json: package.json
	@printf -- 'NEEDED: npm\n'
	npm install

ts: $(BUILD)/extension.js

# Build files with tsc
$(BUILD)/extension.js $(BUILD)/resources.js: $(SRCS) ./node_modules/.package-lock.json
	@printf -- 'NEEDED: tsc\n'
	tsc
	@touch $(BUILD)/extension.js
	if ! grep -qF 'const inserted' $(BUILD)/resources.js; then \
		f=$$(mktemp); \
		printf -- 'const inserted = {\n\t"temp": `' > $$f; \
		printf -- 'temp' >> $$f; \
		printf -- '`\n};\n' >> $$f; \
		cat $(BUILD)/resources.js >> $$f; \
		mv $$f $(BUILD)/resources.js; \
	fi

$(SCHEMAOUT): $(SCHEMASRC)
	@printf -- 'NEEDED: glib-compile-schemas\n'
	mkdir -p $(SCHEMAOUTDIR)
	glib-compile-schemas $(SCHEMAS) --targetdir=$(SCHEMAOUTDIR) --strict

$(SCHEMACP): $(SCHEMASRC)
	mkdir -p $(SCHEMAOUTDIR)
	cp $(SCHEMASRC) $(SCHEMACP)

$(STATICOUT): $(BUILD)/%: $(STATIC)/%
	mkdir -p $(BUILD)
	cp $< $@

$(POT): $(SRCS)
	@printf -- 'NEEDED: xgettext\n'
	mkdir -p $(PO)
	xgettext --from-code=UTF-8 -o $(POT) -k_g -k_p -F \
		-L JavaScript --copyright-holder='Roman Lefler' \
		--package-name=$(UUID) --package-version=$(VERSION) \
		--msgid-bugs-address='romanlefler at proton dot me' \
		$(SRCS)

$(BUILD)/locale/%/LC_MESSAGES/$(UUID).mo: $(PO)/%.po
	@printf -- 'NEEDED: msgfmt\n'
	mkdir -p $(BUILD)/locale/$*/LC_MESSAGES
	msgfmt -c $< -o $@

$(ZIP): out
	@printf -- 'NEEDED: zip\n'
	mkdir -p $(DIST)
	(cd $(BUILD) && zip ../../$(ZIP) -9r ./)

