{
  description = "LearnHarness — an adaptive teaching agent harness with persistent knowledge graph";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          nodejs = pkgs.nodejs_22;
        in
        {
          learnharness = pkgs.buildNpmPackage rec {
            pname = "learnharness";
            version = "0.3.9";

            src = pkgs.lib.cleanSourceWith {
              src = ./.;
              filter =
                path: type:
                let
                  baseName = baseNameOf (toString path);
                in
                !(
                  baseName == ".git"
                  || baseName == "data"
                  || baseName == "node_modules"
                  || baseName == ".next"
                  || baseName == "dist"
                  || baseName == "auth.json"
                );
            };

            npmDepsHash = "sha256-LB0o9cxj4xR0PZyaQ9t7omIpx/+2fQJtLxyEycSnH1Q=";

            inherit nodejs;

            nativeBuildInputs = [
              pkgs.makeWrapper
            ];

            # Next.js telemetry off & build production standalone
            env = {
              NEXT_TELEMETRY_DISABLED = "1";
              NODE_ENV = "production";
            };

            buildPhase = ''
              runHook preBuild
              npm run build
              ${nodejs}/bin/node scripts/build-server.mjs
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/learnharness $out/bin
              cp -r .next/standalone/* $out/lib/learnharness/
              makeWrapper ${nodejs}/bin/node $out/bin/learnharness \
                --add-flags "$out/lib/learnharness/server.js"
              runHook postInstall
            '';

            meta = with pkgs.lib; {
              description = "An adaptive teaching agent harness with persistent knowledge graph";
              homepage = "https://github.com/amosblomqvist/learnharness";
              license = licenses.agpl3Only;
              mainProgram = "learnharness";
              platforms = supportedSystems;
            };
          };

          default = self.packages.${system}.learnharness;
        }
      );

      nixosModules = {
        learnharness =
          { config, pkgs, lib, ... }:
          {
            imports = [ ./nix/module.nix ];
            services.learnharness.package = lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.learnharness;
          };
        default = self.nixosModules.learnharness;
      };
    };
}
