#!/usr/bin/env python3
"""
Simple test runner for ByteNite service components
"""

import sys
import os
import unittest

def run_tests():
    """Run all tests and return results"""
    # Add tests directory to path
    tests_dir = os.path.join(os.path.dirname(__file__), 'tests')
    sys.path.insert(0, tests_dir)
    
    # Discover and run tests
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Load specific test modules
    test_modules = [
        'test_partitioner',
        'test_app_simple', 
        'test_assembler_simple'
    ]
    
    total_tests = 0
    total_passed = 0
    
    for module_name in test_modules:
        print(f"\n=== Running {module_name} ===")
        try:
            module = __import__(module_name)
            test_suite = loader.loadTestsFromModule(module)
            result = unittest.TextTestRunner(verbosity=2).run(test_suite)
            
            total_tests += result.testsRun
            total_passed += result.testsRun - len(result.failures) - len(result.errors)
            
        except Exception as e:
            print(f"Error running {module_name}: {e}")
    
    print(f"\n=== SUMMARY ===")
    print(f"Total tests: {total_tests}")
    print(f"Passed: {total_passed}")
    print(f"Failed: {total_tests - total_passed}")
    
    if total_passed == total_tests:
        print("✅ All tests passed!")
        return True
    else:
        print("❌ Some tests failed!")
        return False

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1) 