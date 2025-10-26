// Test script to verify delivery verification routes
const testUID = 'yTqem3lPHZbVvAqNqLLUvH9uoRi1';

async function testRoutes() {
    try {
        // Test status route
        console.log('Testing status route...');
        const response = await fetch(`http://localhost:5000/api/delivery-verification/${testUID}/status`);
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', data);
        
        // Test check-access route
        console.log('\nTesting check-access route...');
        const accessResponse = await fetch(`http://localhost:5000/api/delivery-verification/${testUID}/check-access`);
        console.log('Access Status:', accessResponse.status);
        const accessData = await accessResponse.json();
        console.log('Access Data:', accessData);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testRoutes();