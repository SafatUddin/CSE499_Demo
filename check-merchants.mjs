import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkMerchants() {
  try {
    const allMerchants = await prisma.merchant.findMany({
      include: { store: true },
    });
    
    console.log('\n=== ALL MERCHANTS ===');
    console.log('Total merchants:', allMerchants.length);
    
    allMerchants.forEach((m, i) => {
      console.log(`\n${i + 1}. ${m.name} (${m.email})`);
      console.log(`   Has store: ${m.store ? 'Yes - ' + m.store.name : 'No'}`);
    });
    
    const nonAdminMerchants = allMerchants.filter(m => m.email !== 'remlin75@gmail.com');
    console.log('\n=== NON-ADMIN MERCHANTS ===');
    console.log('Count:', nonAdminMerchants.length);
    
    if (nonAdminMerchants.length === 0) {
      console.log('\n⚠️  No non-admin merchants found in database!');
      console.log('   This is why the admin dashboard shows no data.');
      console.log('   You need to sign up some test merchants first.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMerchants();
