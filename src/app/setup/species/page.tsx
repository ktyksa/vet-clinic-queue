import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { requirePermission } from "@/lib/auth/require-auth";

export default async function SetupSpeciesPage() {
    await requirePermission("user", "manage");

    const dog = await prisma.species.upsert({
        where: { speciesCode: "DOG" },
        update: {},
        create: {
        speciesCode: "DOG",
        speciesName: "Dog",
        breeds: {
            create: [
            { breedName: "Golden Retriever" },
            { breedName: "Labrador Retriever" },
            { breedName: "Pomeranian" },
            { breedName: "Shih Tzu" },
            { breedName: "Thai Ridgeback" },
            { breedName: "Mixed Breed" },
            { breedName: "Thai Bangkaew" },
            { breedName: "Chihuahua" },
            { breedName: "Poodle" },
            { breedName: "French Bulldog" },
            { breedName: "Pug" },
            { breedName: "Welsh Corgi" },
            { breedName: "Siberian Husky" },
            { breedName: "Beagle" },
            { breedName: "Shiba Inu" },
            { breedName: "Yorkshire Terrier" },
            { breedName: "Maltese" },
            { breedName: "German Shepherd" },
            { breedName: "American Bully" },
            { breedName: "Rottweiler" },
            { breedName: "Jack Russell Terrier" },
            { breedName: "Thai Local Mixed Breed" }
            ],
        },
        },
    });

    const cat = await prisma.species.upsert({
        where: { speciesCode: "CAT" },
        update: {},
        create: {
        speciesCode: "CAT",
        speciesName: "Cat",
        breeds: {
            create: [
            { breedName: "Persian" },
            { breedName: "British Shorthair" },
            { breedName: "Scottish Fold" },
            { breedName: "Siamese" },
            { breedName: "Mixed Breed" },
            { breedName: "American Shorthair" },
            { breedName: "Ragdoll" },
            { breedName: "Maine Coon" },
            { breedName: "Exotic Shorthair" },
            { breedName: "Munchkin" },
            { breedName: "Sphynx" },
            { breedName: "Bengal" },
            { breedName: "Khao Manee" },
            { breedName: "Korat" },
            { breedName: "Suphalak" },
            { breedName: "Konja" },
            { breedName: "Thai Domestic Shorthair" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const rabbit = await prisma.species.upsert({
        where: { speciesCode: "RABBIT" },
        update: {},
        create: {
        speciesCode: "RABBIT",
        speciesName: "Rabbit",
        breeds: {
            create: [
            { breedName: "Holland Lop" },
            { breedName: "Netherland Dwarf" },
            { breedName: "Mixed Breed" },
            { breedName: "Mini Lop" },
            { breedName: "Teddy Bear" },
            { breedName: "Woody Toy" },
            { breedName: "Mini Rex" },
            { breedName: "Lionhead" },
            { breedName: "Angora" },
            { breedName: "New Zealand White" },
            { breedName: "Thai Local Rabbit" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const bird = await prisma.species.upsert({
        where: { speciesCode: "BIRD" },
        update: {},
        create: {
        speciesCode: "BIRD",
        speciesName: "Bird",
        breeds: {
            create: [
            // ขนาดเล็ก
            { breedName: "Forpus" },
            { breedName: "Lovebird" },
            { breedName: "Budgerigar" },
            { breedName: "Zebra Finch" },
            
            // ขนาดกลาง
            { breedName: "Cockatiel" },
            { breedName: "Green-cheeked Conure" },
            { breedName: "Sun Conure" },
            { breedName: "Monk Parakeet" },
            { breedName: "Ringneck" },
            
            // ขนาดใหญ่
            { breedName: "African Grey" },
            { breedName: "Cockatoo" },
            { breedName: "Macaw" },
            { breedName: "Eclectus" },
            
            // ทั่วไป
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const rodent = await prisma.species.upsert({
        where: { speciesCode: "RODENT" }, // หรือจะใช้คำว่า RAT / HAMSTER ตามสะดวกครับ
        update: {},
        create: {
        speciesCode: "RODENT",
        speciesName: "Rodent",
        breeds: {
            create: [
            // กลุ่มแฮมสเตอร์
            { breedName: "Winter White Hamster" },
            { breedName: "Syrian Hamster" },
            { breedName: "Roborovski Hamster" },
            { breedName: "Campbell Hamster" },
            
            // กลุ่มแกสบี้
            { breedName: "American Guinea Pig" },
            { breedName: "Abyssinian Guinea Pig" },
            { breedName: "Peruvian Guinea Pig" },
            { breedName: "Coronet Guinea Pig" },
            { breedName: "Skinny Pig" },
            
            // กลุ่มอื่น ๆ
            { breedName: "Chinchilla" },
            { breedName: "Degu" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const squirrel = await prisma.species.upsert({
        where: { speciesCode: "SQUIRREL" },
        update: {},
        create: {
        speciesCode: "SQUIRREL",
        speciesName: "Squirrel",
        breeds: {
            create: [
            // กระรอกต้นไม้
            { breedName: "Finlayson's Squirrel" },
            { breedName: "Variable Squirrel" },
            { breedName: "Red-bellied Tree Squirrel" },
            { breedName: "Prevost's Squirrel" },
            { breedName: "Japanese Squirrel" },
            
            // กระรอกดิน / ชิปมังก์
            { breedName: "Siberian Chipmunk" },
            { breedName: "Prairie Dog" },
            
            // กลุ่มบิน / ชูการ์
            { breedName: "Sugar Glider" },
            { breedName: "Javan Sun Squirrel" },
            
            // ทั่วไป
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const turtle = await prisma.species.upsert({
        where: { speciesCode: "TURTLE" }, // สามารถใช้ TURTLE หรือ TORTOISE ก็ได้ครับ
        update: {},
        create: {
        speciesCode: "TURTLE",
        speciesName: "Turtle & Tortoise",
        breeds: {
            create: [
            // กลุ่มเต่าบก (Tortoises)
            { breedName: "Sulcata Tortoise" },
            { breedName: "Leopard Tortoise" },
            { breedName: "Indian Star Tortoise" },
            { breedName: "Radiated Tortoise" },
            { breedName: "Red-footed Tortoise" },
            
            // กลุ่มเต่าน้ำ (Water Turtles)
            { breedName: "Red-eared Slider" },
            { breedName: "Common Snapping Turtle" },
            { breedName: "Alligator Snapping Turtle" },
            { breedName: "Pig-nosed Turtle" },
            { breedName: "Razor-backed Musk Turtle" },
            
            // กลุ่มทั่วไป
            { breedName: "Thai Local Turtle" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const cow = await prisma.species.upsert({
        where: { speciesCode: "COW" }, // สามารถใช้ COW หรือ CATTLE ก็ได้ครับ
        update: {},
        create: {
        speciesCode: "COW",
        speciesName: "Cow & Cattle",
        breeds: {
            create: [
            // กลุ่มวัวเนื้อ (Beef Cattle)
            { breedName: "Brahman" },
            { breedName: "Charolais" },
            { breedName: "Angus" },
            { breedName: "Wagyu" },
            { breedName: "Nelore" },
            
            // กลุ่มวัวนม (Dairy Cattle)
            { breedName: "Holstein Friesian" },
            { breedName: "Jersey" },
            { breedName: "Thai Milking Zebu" },
            
            // กลุ่มพื้นเมืองและทั่วไป
            { breedName: "Thai Native Cattle" },
            { breedName: "Khao Lamphun" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const buffalo = await prisma.species.upsert({
        where: { speciesCode: "BUFFALO" },
        update: {},
        create: {
        speciesCode: "BUFFALO",
        speciesName: "Water Buffalo",
        breeds: {
            create: [
            // กลุ่มควายปลักและควายสวยงาม (Swamp Buffalo)
            { breedName: "Thai Swamp Buffalo" },
            { breedName: "Phuak Buffalo" },
            { breedName: "Thai Giant Buffalo" },
            
            // กลุ่มควายแม่น้ำและควายนม (River Buffalo)
            { breedName: "Murrah" },
            { breedName: "Nili-Ravi" },
            
            // กลุ่มลูกผสมและทั่วไป
            { breedName: "Crossbred Buffalo" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const horse = await prisma.species.upsert({
        where: { speciesCode: "HORSE" },
        update: {},
        create: {
        speciesCode: "HORSE",
        speciesName: "Horse",
        breeds: {
            create: [
            // กลุ่มม้ากีฬาและม้าใช้งาน (Sport & Riding)
            { breedName: "Thoroughbred" },
            { breedName: "Quarter Horse" },
            { breedName: "Warmblood" },
            { breedName: "Arabian" },
            
            // กลุ่มม้าเล็กและม้าแคระ (Ponies & Miniatures)
            { breedName: "Miniature Horse" },
            { breedName: "Shetland Pony" },
            
            // กลุ่มพื้นเมืองและทั่วไป
            { breedName: "Thai Native Horse" },
            { breedName: "Crossbred Horse" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const goat = await prisma.species.upsert({
        where: { speciesCode: "GOAT" },
        update: {},
        create: {
        speciesCode: "GOAT",
        speciesName: "Goat",
        breeds: {
            create: [
            // กลุ่มแพะเนื้อ (Beef Goats)
            { breedName: "Boer" },
            { breedName: "Kalahari Red" },
            
            // กลุ่มแพะนม (Dairy Goats)
            { breedName: "Saanen" },
            { breedName: "Alpine" },
            { breedName: "Toggenburg" },
            { breedName: "Jamnapari" },
            
            // กลุ่มแพะแคระและแฟนซี (Miniature & Fancy)
            { breedName: "Pygmy Goat" },
            { breedName: "Nigerian Dwarf" },
            
            // กลุ่มพื้นเมืองและทั่วไป
            { breedName: "Thai Native Goat" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const sheep = await prisma.species.upsert({
        where: { speciesCode: "SHEEP" },
        update: {},
        create: {
        speciesCode: "SHEEP",
        speciesName: "Sheep",
        breeds: {
            create: [
            // กลุ่มแกะเนื้อและแกะผลัดขน (Hair Sheep)
            { breedName: "Santa Ines" },
            { breedName: "Dorper" },
            { breedName: "Katahdin" },
            
            // กลุ่มแกะขนและแกะสวยงาม (Wool Sheep)
            { breedName: "Corriedale" },
            { breedName: "Merino" },
            
            // กลุ่มแกะแคระและแกะแปลก (Miniature & Exotic)
            { breedName: "Ouessant Sheep" },
            { breedName: "Jacob Sheep" },
            
            // กลุ่มพื้นเมืองและทั่วไป
            { breedName: "Thai Native Sheep" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const pig = await prisma.species.upsert({
        where: { speciesCode: "PIG" }, // สามารถใช้ PIG หรือ SWINE ก็ได้ครับ
        update: {},
        create: {
        speciesCode: "PIG",
        speciesName: "Pig & Swine",
        breeds: {
            create: [
            // กลุ่มหมูเศรษฐกิจ (Commercial)
            { breedName: "Large White" },
            { breedName: "Landrace" },
            { breedName: "Duroc Jersey" },
            { breedName: "Pietrain" },
            
            // กลุ่มพื้นเมือง (Native)
            { breedName: "Thai Native Pig" },
            { breedName: "Moo Kaew" },
            { breedName: "Meishan" },
            
            // กลุ่มหมูแคระสัตว์เลี้ยง (Miniature)
            { breedName: "Pot-bellied Pig" },
            
            // กลุ่มลูกผสมและทั่วไป
            { breedName: "Three-Breed Crossbred" },
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const chicken = await prisma.species.upsert({
        where: { speciesCode: "CHICKEN" }, // สามารถใช้ CHICKEN หรือ POULTRY ก็ได้ครับ
        update: {},
        create: {
        speciesCode: "CHICKEN",
        speciesName: "Chicken & Poultry",
        breeds: {
            create: [
            // กลุ่มไก่ชนและพื้นเมือง (Native & Game Fowl)
            { breedName: "Pradu Hang Dam" },
            { breedName: "Luang Hang Khao" },
            { breedName: "Thai Game Fowl" },
            
            // กลุ่มไก่เศรษฐกิจ (Commercial)
            { breedName: "Broiler" },
            { breedName: "Rhode Island Red" },
            { breedName: "Leghorn" },
            
            // กลุ่มไก่แฟนซีและสัตว์เลี้ยง (Fancy & Ornamental)
            { breedName: "Silkie" },
            { breedName: "Serama" },
            { breedName: "Thai Bantam" },
            { breedName: "Polish Chicken" },
            
            // กลุ่มทั่วไป
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const duck = await prisma.species.upsert({
        where: { speciesCode: "DUCK" },
        update: {},
        create: {
        speciesCode: "DUCK",
        speciesName: "Duck",
        breeds: {
            create: [
            // กลุ่มเป็ดไข่ (Layer)
            { breedName: "Khaki Campbell" },
            { breedName: "Nakhon Pathom" },
            { breedName: "Pak Chong" },
            
            // กลุ่มเป็ดเนื้อ (Meat)
            { breedName: "Pekin Duck" },
            { breedName: "Muscovy Duck" },
            { breedName: "Cherry Valley" },
            
            // กลุ่มสวยงามและสัตว์เลี้ยง (Fancy & Ornamental)
            { breedName: "Call Duck" },
            { breedName: "Indian Runner" },
            { breedName: "Mandarin Duck" },
            
            // กลุ่มทั่วไป
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

    const goose = await prisma.species.upsert({
        where: { speciesCode: "GOOSE" },
        update: {},
        create: {
        speciesCode: "GOOSE",
        speciesName: "Goose",
        breeds: {
            create: [
            // กลุ่มห่านเศรษฐกิจและใช้งาน (Commercial & Utility)
            { breedName: "Chinese Goose" },
            { breedName: "Toulouse Goose" },
            { breedName: "Embden Goose" },
            
            // กลุ่มสวยงามและสัตว์เลี้ยง (Fancy & Ornamental)
            { breedName: "African Goose" },
            { breedName: "Sebastopol Goose" },
            { breedName: "Pilgrim Goose" },
            
            // กลุ่มทั่วไป
            { breedName: "Mixed Breed" }
            ],
        },
        },
        include: {
        breeds: true,
        },
    });

  return (
    <AppShell>
      <div className="p-6">
      <h1 className="text-2xl font-bold">Setup Species Completed</h1>

      <pre className="mt-4 rounded border bg-gray-50 p-4">
        {JSON.stringify({ dog, cat, rabbit, bird, rodent, squirrel, turtle, cow, buffalo, horse, goat, sheep, pig, chicken, duck, goose }, null, 2)}
      </pre>
      </div>
    </AppShell>
  );
}