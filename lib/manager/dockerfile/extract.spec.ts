import { loadFixture } from '../../../test/util';
import { extractPackageFile, getDep, splitImageParts } from './extract';

const d1 = loadFixture('1.Dockerfile');
const d2 = loadFixture('2.Dockerfile');

describe('manager/dockerfile/extract', () => {
  describe('extractPackageFile()', () => {
    it('handles no FROM', () => {
      const res = extractPackageFile('no from!');
      expect(res).toBeNull();
    });
    it('handles naked dep', () => {
      const res = extractPackageFile('FROM node\n').deps;
      expect(res).toMatchSnapshot([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: undefined,
          datasource: 'docker',
          depName: 'node',
          depType: 'final',
          replaceString: 'node',
        },
      ]);
    });
    it('is case insensitive', () => {
      const res = extractPackageFile('From node\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node",
          },
        ]
      `);
    });
    it('handles tag', () => {
      const res = extractPackageFile('FROM node:8.9.0-alpine\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.9.0-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:8.9.0-alpine",
          },
        ]
      `);
    });
    it('handles digest', () => {
      const res = extractPackageFile(
        'FROM node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
          },
        ]
      `);
    });
    it('handles tag and digest', () => {
      const res = extractPackageFile(
        'FROM node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": "sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
            "currentValue": "8.9.0",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:8.9.0@sha256:eb85fc5b1198f5e1ec025ea07586bdbbf397e7d82df66c90d7511f533517e063",
          },
        ]
      `);
    });
    it('handles from as', () => {
      const res = extractPackageFile('FROM node:8.9.0-alpine as base\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.9.0-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:8.9.0-alpine",
          },
        ]
      `);
    });
    it('handles comments', () => {
      const res = extractPackageFile(
        '# some comment\n# another\n\nFROM node\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node",
          },
        ]
      `);
    });
    it('handles custom hosts', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/node:8\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "registryUrls": Array [
              "https://registry2.something.info",
            ],
            "replaceString": "node:8",
          },
        ]
      `);
    });
    it('handles custom hosts and suffix', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/node:8-alpine\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8-alpine",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "registryUrls": Array [
              "https://registry2.something.info",
            ],
            "replaceString": "node:8-alpine",
          },
        ]
      `);
    });
    it('handles custom hosts with port', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info:5005/node:8\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "registryUrls": Array [
              "https://registry2.something.info:5005",
            ],
            "replaceString": "node:8",
          },
        ]
      `);
      expect(res[0].depName).toEqual('node');
      expect(res[0].currentValue).toEqual('8');
    });
    it('handles registries with a path', () => {
      const res = extractPackageFile(
        'FROM registry.example.com/proxy-cache/library/node:12.19.1\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{lookupName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "12.19.1",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "lookupName": "library/node",
            "registryUrls": Array [
              "https://registry.example.com/proxy-cache",
            ],
            "replaceString": "library/node:12.19.1",
          },
        ]
      `);
      expect(res[0].depName).toEqual('node');
      expect(res[0].currentValue).toEqual('12.19.1');
    });

    it('handles custom hosts with port without tag', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info:5005/node\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": undefined,
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "registryUrls": Array [
              "https://registry2.something.info:5005",
            ],
            "replaceString": "node",
          },
        ]
      `);
      expect(res[0].depName).toEqual('node');
    });
    it('handles quay hosts with port', () => {
      const res = extractPackageFile('FROM quay.io:1234/node\n').deps;
      expect(res[0]).toMatchInlineSnapshot(`
        Object {
          "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
          "currentDigest": undefined,
          "currentValue": undefined,
          "datasource": "docker",
          "depName": "node",
          "depType": "final",
          "registryUrls": Array [
            "https://quay.io:1234",
          ],
          "replaceString": "node",
        }
      `);
    });
    it('handles namespaced images', () => {
      const res = extractPackageFile('FROM mynamespace/node:8\n').deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "mynamespace/node",
            "depType": "final",
            "replaceString": "mynamespace/node:8",
          },
        ]
      `);
    });
    it('handles custom hosts with namespace', () => {
      const res = extractPackageFile(
        'FROM registry2.something.info/someaccount/node:8\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8",
            "datasource": "docker",
            "depName": "someaccount/node",
            "depType": "final",
            "registryUrls": Array [
              "https://registry2.something.info",
            ],
            "replaceString": "someaccount/node:8",
          },
        ]
      `);
    });
    it('handles abnormal spacing', () => {
      const res = extractPackageFile(
        'FROM    registry.allmine.info:5005/node:8.7.0\n\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "8.7.0",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "registryUrls": Array [
              "https://registry.allmine.info:5005",
            ],
            "replaceString": "node:8.7.0",
          },
        ]
      `);
    });
    it('extracts multiple FROM tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM python:3.6-slim\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "6.12.3",
            "datasource": "docker",
            "depName": "node",
            "depType": "stage",
            "replaceString": "node:6.12.3",
          },
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "3.6-slim",
            "datasource": "docker",
            "depName": "python",
            "depType": "final",
            "replaceString": "python:3.6-slim",
          },
        ]
      `);
      expect(res).toHaveLength(2);
    });
    it('skips scratches', () => {
      const res = extractPackageFile('FROM scratch\nADD foo\n');
      expect(res).toBeNull();
    });
    it('skips named multistage FROM tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nFROM frontend\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "6.12.3",
            "datasource": "docker",
            "depName": "node",
            "depType": "final",
            "replaceString": "node:6.12.3",
          },
        ]
      `);
      expect(res).toHaveLength(1);
    });
    it('handles COPY --from', () => {
      const res = extractPackageFile(
        'FROM scratch\nCOPY --from=gcr.io/k8s-skaffold/skaffold:v0.11.0 /usr/bin/skaffold /usr/bin/skaffold\n'
      ).deps;
      expect(res).toMatchInlineSnapshot(`
        Array [
          Object {
            "autoReplaceStringTemplate": "{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}",
            "currentDigest": undefined,
            "currentValue": "v0.11.0",
            "datasource": "docker",
            "depName": "k8s-skaffold/skaffold",
            "depType": "final",
            "registryUrls": Array [
              "https://gcr.io",
            ],
            "replaceString": "k8s-skaffold/skaffold:v0.11.0",
          },
        ]
      `);
    });
    it('skips named multistage COPY --from tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nCOPY --from=frontend /usr/bin/node /usr/bin/node\n'
      ).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('skips index reference COPY --from tags', () => {
      const res = extractPackageFile(
        'FROM node:6.12.3 as frontend\n\n# comment\nENV foo=bar\nCOPY --from=0 /usr/bin/node /usr/bin/node\n'
      ).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('detects ["stage"] and ["final"] deps of docker multi-stage build.', () => {
      const res = extractPackageFile(
        'FROM node:8.15.1-alpine as skippedfrom\nFROM golang:1.7.3 as builder\n\n# comment\nWORKDIR /go/src/github.com/alexellis/href-counter/\nRUN go get -d -v golang.org/x/net/html  \nCOPY app.go    .\nRUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .\n\nFROM alpine:latest  \nRUN apk --no-cache add ca-certificates\nWORKDIR /root/\nCOPY --from=builder /go/src/github.com/alexellis/href-counter/app .\nCMD ["./app"]\n'
      ).deps;
      expect(res).toMatchSnapshot();
      const passed = [
        res[2].depType === 'final',
        res[1].depType === 'stage',
        res[0].depType === 'stage',
      ].every(Boolean);
      expect(passed).toBe(true);
    });
    it('extracts images on adjacent lines', () => {
      const res = extractPackageFile(d1).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('extracts images from all sorts of (maybe multiline) FROM and COPY --from statements', () => {
      const res = extractPackageFile(d2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(9);
    });
    it('handles calico/node', () => {
      const res = extractPackageFile('FROM calico/node\n').deps;
      expect(res).toMatchSnapshot([
        {
          datasource: 'docker',
          depName: 'calico/node',
          replaceString: 'calico/node',
        },
      ]);
    });
    it('handles ubuntu', () => {
      const res = extractPackageFile('FROM ubuntu:18.04\n').deps;
      expect(res).toMatchSnapshot([
        {
          currentValue: '18.04',
          depName: 'ubuntu',
          versioning: 'ubuntu',
        },
      ]);
    });

    it('handles prefixes', () => {
      const res = extractPackageFile('FROM amd64/ubuntu:18.04\n').deps;
      expect(res).toMatchSnapshot([
        {
          currentValue: '18.04',
          depName: 'ubuntu',
          lookupName: 'amd64/ubuntu',
          versioning: 'ubuntu',
          autoReplaceStringTemplate:
            '{{lookupName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        },
      ]);
    });
  });
  describe('getDep()', () => {
    it('rejects null', () => {
      expect(getDep(null)).toEqual({ skipReason: 'invalid-value' });
    });
  });
  describe('splitImageParts()', () => {
    it('handles docker hub', () => {
      expect(splitImageParts('node:14')).toMatchInlineSnapshot(`
        Object {
          "currentDigest": undefined,
          "currentValue": "14",
          "depName": "node",
        }
      `);
    });
    it('handles docker hub with full host', () => {
      expect(splitImageParts('docker.io/node:14')).toMatchInlineSnapshot(`
        Object {
          "currentDigest": undefined,
          "currentValue": "14",
          "depName": "node",
          "registryUrls": Array [
            "https://docker.io",
          ],
        }
      `);
    });
  });
});
