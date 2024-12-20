FROM node:18.12.1

RUN apt update -y && apt install -y build-essential libgmp-dev libsodium-dev nasm nlohmann-json3-dev

COPY --from=rapidsnark /rapidsnark /rapidsnark

WORKDIR /app

RUN corepack enable

# install foundry
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="$PATH:/root/.cargo/bin"
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="$PATH:/root/.foundry/bin"
RUN foundryup -C e15e33a

# copy over entire monorepo
COPY . .

# copy over subtree update artifacts
COPY --from=circuit-artifacts ./subtreeupdate ./circuit-artifacts/subtreeupdate


# install deps & build
RUN yarn install

# build witness generator
WORKDIR /app/actors/subtree-updater
RUN ./build_witness_generator.sh


# build
WORKDIR /app
RUN yarn turbo run build --filter="@nocturne-xyz/subtree-updater..."


# setup CLI
WORKDIR /app/actors/subtree-updater
RUN npm i -g 

ENTRYPOINT ["subtree-updater-cli"]
