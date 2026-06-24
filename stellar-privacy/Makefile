# ShieldedBridge — top-level developer tasks.
.PHONY: help tools build test contracts-test circuits-test wasm frontend deploy clean

help:
	@echo "ShieldedBridge"
	@echo "  make tools          install rust, stellar-cli, circom"
	@echo "  make build          build contracts (wasm) + circuits + frontend"
	@echo "  make test           run all tests (contracts + circuits crypto)"
	@echo "  make wasm           build Soroban contracts to wasm32v1-none"
	@echo "  make circuits       compile circuits + trusted setup (needs circom)"
	@echo "  make frontend       dev server for the wallet UI"
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

frontend:
	cd frontend && pnpm install && pnpm dev

build: wasm
	cd circuits && pnpm install
	cd frontend && pnpm install && pnpm build

deploy:
	bash scripts/deploy_testnet.sh

clean:
	cd contracts && cargo clean
	rm -rf circuits/build frontend/dist
