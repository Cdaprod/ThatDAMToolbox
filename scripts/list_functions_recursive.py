import os
import ast

def list_functions(filename, relpath):
    with open(filename, 'r', encoding='utf-8') as f:
        try:
            tree = ast.parse(f.read(), filename=filename)
        except SyntaxError:
            return []
    funcs = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            funcs.append(f"{relpath}:{node.lineno} - def {node.name}({', '.join(arg.arg for arg in node.args.args)})")
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    funcs.append(f"{relpath}:{item.lineno} - class {node.name}.{item.name}({', '.join(arg.arg for arg in item.args.args)})")
    return funcs

def walk_and_list(rootdir):
    results = []
    for dirpath, dirs, files in os.walk(rootdir):
        for f in files:
            if f.endswith('.py'):
                full = os.path.join(dirpath, f)
                rel = os.path.relpath(full, rootdir)
                results.extend(list_functions(full, rel))
    return results

if __name__ == '__main__':
    allfuncs = walk_and_list(os.getcwd())
    for func in allfuncs:
        print(func)