doc:
	./node_modules/.bin/groc "lib/**/*" README.md -e "lib/utilities.js"

doc_publish:
	./node_modules/.bin/groc "lib/**/*" README.md -e "lib/utilities.js" --gh

test:
	@NODE_ENV=test ./node_modules/.bin/nodeunit test/unit/**/*

.PHONY: test doc doc_publish
