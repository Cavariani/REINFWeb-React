using Microsoft.EntityFrameworkCore;
using ReinfApi.Models;

namespace ReinfApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AppUser> Usuarios => Set<AppUser>();
    public DbSet<Certificate> Certificados => Set<Certificate>();
    public DbSet<Lote> Lotes => Set<Lote>();
    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<AppUser>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
        });

        mb.Entity<AppUser>()
            .HasMany(u => u.Empresas)
            .WithMany(e => e.Usuarios)
            .UsingEntity<Dictionary<string, object>>(
                "USUARIO_EMPRESA",
                r => r.HasOne<Empresa>().WithMany().HasForeignKey("EMPRESA_ID"),
                l => l.HasOne<AppUser>().WithMany().HasForeignKey("USUARIO_ID"),
                j => j.HasKey("USUARIO_ID", "EMPRESA_ID")
            );

        mb.Entity<Certificate>(e =>
        {
            // Certificado pertence a uma Empresa (novo modelo)
            e.HasOne(c => c.Empresa)
             .WithMany(emp => emp.Certificados)
             .HasForeignKey(c => c.EmpresaId)
             .OnDelete(DeleteBehavior.SetNull);

            // UsuarioId mantido nullable para compatibilidade com dados antigos
            e.Property(c => c.UsuarioId).HasColumnName("ID_USUARIO");
        });

        mb.Entity<Empresa>(e =>
        {
            // Self-referencing FK: contribuinte → emissora responsável (legado)
            e.HasOne<Empresa>()
             .WithMany()
             .HasForeignKey(emp => emp.EmissoraId)
             .OnDelete(DeleteBehavior.NoAction);

            // Certificado diretamente vinculado ao contribuinte (novo modelo)
            e.HasOne(emp => emp.Certificado)
             .WithMany()
             .HasForeignKey(emp => emp.CertificadoId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // FKs para CLIENTES (simples, sem navigation properties nos modelos filhos)
        mb.Entity<AppUser>()
            .HasOne<Cliente>().WithMany().HasForeignKey(u => u.ClienteId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<Empresa>()
            .HasOne<Cliente>().WithMany().HasForeignKey(e => e.ClienteId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<Certificate>()
            .HasOne<Cliente>().WithMany().HasForeignKey(c => c.ClienteId).OnDelete(DeleteBehavior.Restrict);
        mb.Entity<Lote>()
            .HasOne<Cliente>().WithMany().HasForeignKey(l => l.ClienteId).OnDelete(DeleteBehavior.Restrict);

        mb.Entity<Lote>(e =>
        {
            // Sem IDENTITY — app gera o ID
            e.Property(l => l.IdEnvio).ValueGeneratedNever();

            e.HasOne(l => l.Usuario)
             .WithMany(u => u.Lotes)
             .HasForeignKey(l => l.UsuarioId)
             .OnDelete(DeleteBehavior.SetNull);

            e.HasOne(l => l.Certificado)
             .WithMany(c => c.Lotes)
             .HasForeignKey(l => l.CertificadoId)
             .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
