# /list_functions.py

import os
import sys
import importlib
import pkgutil
import inspect

ROOT = os.path.dirname(os.path.abspath(__file__))

def find_modules(root_path, package=''):
    """Recursively yield all modules under a given root."""
    for loader, name, is_pkg in pkgutil.walk_packages([root_path], package+'.'):
        yield name
        if is_pkg:
            mod_path = os.path.join(root_path, name.replace('.', os.sep))
            yield from find_modules(mod_path, name)

def print_functions(module_name):
    try:
        mod = importlib.import_module(module_name)
    except Exception as e:
        print(f"Could not import {module_name}: {e}")
        return

    print(f"\nMODULE: {module_name}")
    for name, obj in inspect.getmembers(mod, inspect.isfunction):
        if obj.__module__ == module_name:
            print(f"  {name}{inspect.signature(obj)}")
    # Optionally, print class methods:
    for cname, cobj in inspect.getmembers(mod, inspect.isclass):
        if cobj.__module__ == module_name:
            for mname, mobj in inspect.getmembers(cobj, inspect.isfunction):
                print(f"  {cname}.{mname}{inspect.signature(mobj)}")

def main():
    sys.path.insert(0, ROOT)
    # If your package is named 'video', start from there:
    package_root = 'video'
    for module_name in find_modules(os.path.join(ROOT, package_root), package_root):
        print_functions(module_name)

if __name__ == "__main__":
    main()