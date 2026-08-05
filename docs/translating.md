# Translating

Translations are stored as `.po` files in the `po` directory. To start a new translation, run:

```sh
./scripts/new-po.sh <locale>
```

To update the existing `.po` files with the latest translatable text, run:

```sh
make update-po
```

Edit the appropriate `.po` file, then open a pull request to have your translation merged.

If you would like to test the extension and see your translations, run `./debug.sh`. This
requires the mutter-devkit to be installed. For translations you do not have to test it
if you do not want to.

