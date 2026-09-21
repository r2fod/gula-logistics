import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { KeyRound } from 'lucide-react';
import { Campo, Input, Selector, AreaTexto, claseCampo } from './Campo';

afterEach(cleanup);

describe('claseCampo', () => {
  it('por defecto es el campo grande, oscuro y con borde ámbar al enfocar', () => {
    const clase = claseCampo();
    expect(clase).toContain('bg-slate-950');
    expect(clase).toContain('px-4 py-3 text-sm');
    expect(clase).toContain('focus:border-amber-500');
  });

  it('cambia con las opciones', () => {
    const clase = claseCampo({ tamano: 'xs', acento: 'emerald', fondo: 'medio', borde: 'marcado', texto: 'destacado' });
    expect(clase).toContain('bg-slate-900');
    expect(clase).toContain('border-slate-700');
    expect(clase).toContain('p-2 text-xs');
    expect(clase).toContain('rounded-lg');
    expect(clase).toContain('focus:border-emerald-500');
    expect(clase).toContain('text-amber-300 font-bold');
  });

  it('el radio depende del tamaño salvo que se pida otro', () => {
    expect(claseCampo({ tamano: 'lg' })).toContain('rounded-xl');
    expect(claseCampo({ tamano: 'xs' })).toContain('rounded-lg');
    const clase = claseCampo({ tamano: 'lg', redondeo: '2xl' });
    expect(clase).toContain('rounded-2xl');
    expect(clase).not.toContain('rounded-xl');
  });

  it('una opción desconocida cae en el valor por defecto en vez de dejar la clase vacía', () => {
    expect(claseCampo({ tamano: 'gigante', acento: 'lila' })).toContain('focus:border-amber-500');
  });
});

describe('Input, Selector y AreaTexto', () => {
  it('reenvían value, onChange y placeholder al elemento nativo', () => {
    const onChange = vi.fn();
    render(<Input value="hola" onChange={onChange} placeholder="Nombre" />);
    const campo = screen.getByPlaceholderText('Nombre');
    expect(campo.tagName).toBe('INPUT');
    expect(campo).toHaveValue('hola');
    fireEvent.change(campo, { target: { value: 'adiós' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ocupan todo el ancho salvo que se pase su propio className', () => {
    const { rerender } = render(<Input aria-label="a" />);
    expect(screen.getByLabelText('a').className).toContain('w-full');
    rerender(<Input aria-label="a" className="flex-1 min-w-0" />);
    expect(screen.getByLabelText('a').className).not.toContain('w-full');
    expect(screen.getByLabelText('a').className).toContain('flex-1 min-w-0');
  });

  it('Selector y AreaTexto son un select y un textarea', () => {
    render(
      <>
        <Selector aria-label="s"><option value="1">Uno</option></Selector>
        <AreaTexto aria-label="t" />
      </>
    );
    expect(screen.getByLabelText('s').tagName).toBe('SELECT');
    expect(screen.getByLabelText('t').tagName).toBe('TEXTAREA');
  });

  it('reenvían la ref', () => {
    const ref = React.createRef();
    render(<Input ref={ref} aria-label="a" />);
    expect(ref.current).toBe(screen.getByLabelText('a'));
  });
});

describe('Campo', () => {
  it('une la etiqueta con el control', () => {
    render(<Campo etiqueta="Contraseña" icono={KeyRound}><Input type="password" /></Campo>);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('respeta un id que ya tenga el control', () => {
    render(<Campo etiqueta="Nombre"><Input id="propio" /></Campo>);
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('id', 'propio');
  });

  it('muestra la ayuda y funciona sin etiqueta', () => {
    render(<Campo ayuda="Mínimo 6 caracteres"><Input aria-label="x" /></Campo>);
    expect(screen.getByText('Mínimo 6 caracteres')).toBeInTheDocument();
    expect(screen.queryByRole('label')).toBeNull();
  });
});
