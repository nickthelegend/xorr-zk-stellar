# Xorr — top-level developer tasks (contracts + circuits + eth).
.PHONY: help tools build test contracts-test circuits-test wasm circuits eth-build deploy clean

help:
	@echo "Xorr — Stellar contracts + ZK circuits + Ethereum lock"
	@echo "  make tools          install rust, stellar-cli, circom"
	@echo "  make build          build contracts (wasm) + install circuit deps"
	@echo "  make test           run all tests (contracts + circuits crypto)"
	@echo "  make wasm           build Soroban contracts to wasm32v1-none"
	@echo "  make circuits       compile circuits + trusted setup (needs circom)"
	@echo "  make eth-build      build the Ethereum lock contracts (needs foundry)"
	@echo "  make deploy         deploy to Stellar testnet + wire everything"

tools:
	bash scripts/install-tools.sh

wasm:
	cd contracts && cargo build --target wasm32v1-none --release

contracts-test:
	cd contracts && cargo test

circuits-test:
	cd circuits && pnpm install && pnpm test

test: contracts-test circuits-test

circuits:
	cd circuits && pnpm install && pnpm build

eth-build:
	cd eth && forge build

build: wasm
	cd circuits && pnpm install

deploy:
	bash scripts/deploy_testnet.sh

clean:
	cd contracts && cargo clean
	rm -rf circuits/build eth/out eth/cache
