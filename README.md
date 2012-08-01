# spoor

Spoor is designed to present a simple, unified interafce for online task management applications
in a single command line interface, so you can interact with your team while you work without
having to leave your terminal.

[![Build Status](https://secure.travis-ci.org/sonnym/spoor.png?branch=master)](http://travis-ci.org/sonnym/spoor)

## Getting started
Installing spoor is easy, thanks to npm.  If you have node v0.8.1 or higher installed, you can
simply run the following command, and you will have spoor at your finger tips.

    npm install -g spoor

## Integrations
Spoor is split up into separate integrations, each corresponding to a difference service with which
you can interact through the CLI. You can find detailed documentation for all the integrations in the
[annotated source code](http://sonnym.github.com/spoor/).

To obtain a list of integrations, you may simply type `spoor`, which will display the general usage form
as well as the list of available integrations; in order to see the commands within an integration, simply
specify the integration on the command line, e.g. `spoor foo`.

Many commands do not require any options, but commands that have options available can be queried by calling
the command without any arguments, such as with `spoor foo bar`.

### Integration Setup
With any particular integration you wish to use, the first step will be to run the `setup` command, which,
in general, performs two actions.  First, you will be asked to provide your username and password for the
service with which the integration communicates.  Once an authentication token is retreived, you will be able
to interact with the integration without having to constantly enter your credentials.  Second, you will be
asked for information pertaining to the project itself.  This will enable spoor to keep itself synced with
your projects and the services you use to maintain them.

The two different types of information spoor tracks are considered global and local, user and project specific,
respectively, and both are stored in separate locations in order to decouple the data.  The former is stored in
the user's home directory, while the latter is stored in the project root directory, whence spoor is generally
expected to be run.

## Contributing
Please send along any requests for additional integrations or feel free to write your own! If you decide
to add any features to spoor, be sure to write some tests.  We use [groc](https://github.com/nevir/groc)
to generate documentation, so write good comments for the code and the rest will happen automatically!
You can run `make doc` to check the output of your modifications and `make test` to run the test suite.
