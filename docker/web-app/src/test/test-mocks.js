/**
 * Runtime mocks for optional frontend modules in tests.
 *
 * Usage:
 *   NODE_ENV=test node --require ./src/test/test-mocks.js --test <files>
 */
if (process.env.NODE_ENV === 'test') {
  const Module = require('module');
  const path = require('path');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id.startsWith('@/')) {
      const base = path.join(process.cwd(), '.tmp-test');
      const direct = path.join(base, id.slice(2));
      const alt = path.join(base, 'src', id.slice(2));
      try {
        return originalRequire.call(this, direct);
      } catch {
        return originalRequire.call(this, alt);
      }
    }
    if (id === '@mui/material') {
      const React = require('react');
      return new Proxy({}, {
        get: () => (props) => React.createElement(React.Fragment, null, props && props.children)
      });
    }
    if (id === 'next-auth/react') {
      return (global.__nextAuthReact ||= {
        signIn: async () => {},
        useSession: () => ({ status: 'authenticated', data: null }),
      });
    }
    if (id === 'next-auth') {
      return { getServerSession: async () => null };
    }
    if (id === 'next-auth/next') {
      return { getServerSession: async () => null };
    }
    if (id === 'next-auth/providers/google') {
      return () => ({ id: 'google' });
    }
    if (id === 'next-auth/providers/credentials') {
      return () => ({ id: 'credentials' });
    }
    if (id.startsWith('next/navigation')) {
      return (global.__nextNavigation ||= {
        redirect: () => {},
        useRouter: () => ({ replace: () => {} }),
        usePathname: () => '/',
        useParams: () => ({}),
      });
    }
    if (id === 'next/headers') {
      return (
        global.__nextHeaders ||= {
          cookies: async () => {
            const store =
              (global.__cookieStore ||= {
                setCalls: [],
                set(opts) {
                  this.setCalls.push(opts);
                },
              });
            return store;
          },
        }
      );
    }
    if (id === 'react-devtools-core') {
      return { connectToDevTools: () => ({}), startServer: () => {} };
    }
    return originalRequire.call(this, id);
  };
}
