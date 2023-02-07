#!/bin/bash

set -e

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )" 
ROOT_DIR="$SCRIPT_DIR/../../"

cd "$ROOT_DIR"
# git submodule init
# git submodule update

pushd rapidsnark
git submodule init
git submodule update
popd

if [ ! -d "$ROOT_DIR/circuit-artifacts/subtreeupdate/" ]; then
    pushd packages/circuits
    yarn download-big-ptau
    yarn build:subtreeupdate
    yarn local-prover:gen-test-cases
    popd
fi

if [ ! -z "$IS_MOCK" ]; then
    echo "building mock subtree-updater"
    docker build -t mock-subtree-updater -f ./packages/subtree-updater/Mock.Dockerfile .
    exit 0
fi

if [[ $(uname -m) == 'arm64' ]]; then
	echo "dected arm64, building using docker buildx..."

    docker buildx build --platform linux/amd64 -t rapidsnark ./rapidsnark
    docker buildx build --platform linux/amd64 -t subtree-updater -f ./packages/subtree-updater/Dockerfile .
else
    docker build -t rapidsnark ./rapidsnark
    docker build -t subtree-updater -f ./packages/subtree-updater/Dockerfile .
fi